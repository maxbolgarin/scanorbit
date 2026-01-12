package recovery

import (
	"context"
	"time"

	"github.com/maxbolgarin/scanorbit/internal/queue"
	"github.com/maxbolgarin/scanorbit/internal/store"
	"github.com/rs/zerolog"
)

// Runner handles recovery of orphaned jobs from Postgres.
type Runner struct {
	store    store.JobRecoveryStore
	queue    queue.Queue
	period   time.Duration
	ageLimit time.Duration
	logger   zerolog.Logger
}

// NewRunner creates a new recovery runner.
// period: how often to check for orphaned jobs (e.g., 5 minutes)
// ageLimit: how old a queued job must be to be considered orphaned (e.g., 5 minutes)
func NewRunner(st store.JobRecoveryStore, q queue.Queue, period, ageLimit time.Duration, logger zerolog.Logger) *Runner {
	return &Runner{
		store:    st,
		queue:    q,
		period:   period,
		ageLimit: ageLimit,
		logger:   logger.With().Str("component", "recovery").Logger(),
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
	jobs, err := r.store.FindOrphanedJobs(ctx, r.ageLimit)
	if err != nil {
		return 0, err
	}

	if len(jobs) == 0 {
		return 0, nil
	}

	recovered := 0
	for _, job := range jobs {
		// Re-enqueue to Redis
		if err := r.queue.Enqueue(ctx, job.Type, job.Payload); err != nil {
			r.logger.Error().
				Err(err).
				Str("job_id", job.ID).
				Str("job_type", string(job.Type)).
				Msg("failed to re-enqueue orphaned job")
			continue
		}

		// Mark as recovered (resets created_at to prevent re-recovery)
		if err := r.store.MarkJobRecovered(ctx, job.ID); err != nil {
			r.logger.Error().
				Err(err).
				Str("job_id", job.ID).
				Msg("failed to mark job as recovered")
			continue
		}

		r.logger.Debug().
			Str("job_id", job.ID).
			Str("job_type", string(job.Type)).
			Msg("recovered orphaned job")

		recovered++
	}

	return recovered, nil
}
