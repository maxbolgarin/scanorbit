package recovery

import (
	"context"
	"time"

	"github.com/maxbolgarin/scanorbit/internal/queue"
	"github.com/maxbolgarin/scanorbit/internal/store"
	"github.com/rs/zerolog"
)

const (
	// DefaultRecoveryBatchSize is the maximum number of jobs to recover per cycle
	// to prevent recovery floods from overwhelming the system.
	DefaultRecoveryBatchSize = 50
)

// Runner handles recovery of orphaned jobs from Postgres.
type Runner struct {
	store     store.JobRecoveryStore
	dlStore   store.DeadLetterStore
	queue     queue.Queue
	period    time.Duration
	ageLimit  time.Duration
	batchSize int
	logger    zerolog.Logger
}

// NewRunner creates a new recovery runner.
// period: how often to check for orphaned jobs (e.g., 5 minutes)
// ageLimit: how old a queued job must be to be considered orphaned (e.g., 5 minutes)
func NewRunner(st store.JobRecoveryStore, dlStore store.DeadLetterStore, q queue.Queue, period, ageLimit time.Duration, logger zerolog.Logger) *Runner {
	return &Runner{
		store:     st,
		dlStore:   dlStore,
		queue:     q,
		period:    period,
		ageLimit:  ageLimit,
		batchSize: DefaultRecoveryBatchSize,
		logger:    logger.With().Str("component", "recovery").Logger(),
	}
}

// Start runs the recovery loop in the background.
// It blocks until the context is cancelled.
func (r *Runner) Start(ctx context.Context) {
	ticker := time.NewTicker(r.period)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			r.logger.Info().Msg("recovery runner stopped")
			return
		case <-ticker.C:
			recovered, err := r.RecoverOnce(ctx)
			if err != nil {
				r.logger.Error().Err(err).Msg("recovery tick failed")
			} else if recovered > 0 {
				r.logger.Info().Int("count", recovered).Msg("recovered orphaned jobs")
			}
		}
	}
}

// RecoverOnce runs a single recovery pass.
// Returns the number of jobs recovered.
func (r *Runner) RecoverOnce(ctx context.Context) (int, error) {
	recovered := 0

	// Recover jobs stuck in 'queued' status (with batch limit)
	queuedJobs, err := r.store.FindOrphanedJobs(ctx, r.ageLimit, r.batchSize)
	if err != nil {
		return 0, err
	}

	for _, job := range queuedJobs {
		// Check if job has exceeded max recovery attempts
		if job.RecoveryCount >= store.MaxRecoveryAttempts {
			r.handleExhaustedJob(ctx, &job)
			continue
		}

		// Re-enqueue to Redis
		if err := r.queue.Enqueue(ctx, job.Type, job.Payload); err != nil {
			r.logger.Error().
				Err(err).
				Str("job_id", job.ID).
				Str("job_type", string(job.Type)).
				Int("recovery_count", job.RecoveryCount).
				Msg("failed to re-enqueue orphaned queued job")
			continue
		}

		// Mark as recovered (sets status to running and increments recovery_count)
		if err := r.store.MarkJobRecovered(ctx, job.ID); err != nil {
			r.logger.Error().
				Err(err).
				Str("job_id", job.ID).
				Msg("failed to mark queued job as recovered")
			continue
		}

		r.logger.Debug().
			Str("job_id", job.ID).
			Str("job_type", string(job.Type)).
			Int("recovery_count", job.RecoveryCount+1).
			Msg("recovered orphaned queued job")

		recovered++
	}

	// Recover jobs stuck in 'running' status (worker crashed) with batch limit
	runningJobs, err := r.store.FindStuckRunningJobs(ctx, r.ageLimit, r.batchSize)
	if err != nil {
		r.logger.Error().Err(err).Msg("failed to find stuck running jobs")
		// Don't return error, we still recovered some jobs
	} else {
		for _, job := range runningJobs {
			// Check if job has exceeded max recovery attempts
			if job.RecoveryCount >= store.MaxRecoveryAttempts {
				r.handleExhaustedJob(ctx, &job)
				continue
			}

			// Reset to queued for retry
			if err := r.store.ResetJobToQueued(ctx, job.ID); err != nil {
				r.logger.Error().
					Err(err).
					Str("job_id", job.ID).
					Msg("failed to reset stuck running job")
				continue
			}

			// Re-enqueue to Redis
			if err := r.queue.Enqueue(ctx, job.Type, job.Payload); err != nil {
				r.logger.Error().
					Err(err).
					Str("job_id", job.ID).
					Str("job_type", string(job.Type)).
					Int("recovery_count", job.RecoveryCount).
					Msg("failed to re-enqueue stuck running job")
				continue
			}

			// Mark as recovered (sets status back to running and increments recovery_count)
			if err := r.store.MarkJobRecovered(ctx, job.ID); err != nil {
				r.logger.Error().
					Err(err).
					Str("job_id", job.ID).
					Msg("failed to mark running job as recovered")
				continue
			}

			r.logger.Debug().
				Str("job_id", job.ID).
				Str("job_type", string(job.Type)).
				Int("recovery_count", job.RecoveryCount+1).
				Msg("recovered stuck running job")

			recovered++
		}
	}

	return recovered, nil
}

// handleExhaustedJob handles a job that has exceeded max recovery attempts.
// It marks the job as exhausted and creates a dead letter record.
func (r *Runner) handleExhaustedJob(ctx context.Context, job *store.OrphanedJob) {
	r.logger.Warn().
		Str("job_id", job.ID).
		Str("job_type", string(job.Type)).
		Int("recovery_count", job.RecoveryCount).
		Msg("job exceeded max recovery attempts, moving to dead letter")

	// Mark job as exhausted (error status)
	if err := r.store.MarkJobExhausted(ctx, job.ID); err != nil {
		r.logger.Error().
			Err(err).
			Str("job_id", job.ID).
			Msg("failed to mark job as exhausted")
	}

	// Create dead letter record
	if r.dlStore != nil {
		deadJob := &store.DeadLetterJob{
			JobID:   job.ID,
			JobType: string(job.Type),
			Payload: job.Payload,
			Error:   "max recovery attempts exceeded",
			Retries: job.RecoveryCount,
		}
		if err := r.dlStore.Create(ctx, deadJob); err != nil {
			r.logger.Error().
				Err(err).
				Str("job_id", job.ID).
				Msg("failed to create dead letter record for exhausted job")
		}
	}
}
