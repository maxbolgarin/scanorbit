package store

import (
	"context"
	"fmt"
	"time"

	"github.com/maxbolgarin/scanorbit/internal/models"
)

const (
	// MaxRecoveryAttempts is the maximum number of times a job can be recovered
	// before being moved to the dead letter queue.
	MaxRecoveryAttempts = 3
)

// OrphanedJob represents a job stuck in queued state.
type OrphanedJob struct {
	ID             string
	Type           models.JobType
	Payload        []byte
	RecoveryCount  int
}

// JobRecoveryStore defines operations for recovering orphaned jobs.
type JobRecoveryStore interface {
	// FindOrphanedJobs returns jobs that have been in 'queued' status longer than the threshold.
	// Limits results to prevent recovery floods.
	FindOrphanedJobs(ctx context.Context, olderThan time.Duration, limit int) ([]OrphanedJob, error)
	// FindStuckRunningJobs returns jobs that have been in 'running' status longer than the threshold.
	// This catches jobs where the worker crashed mid-processing. Limits results to prevent floods.
	FindStuckRunningJobs(ctx context.Context, olderThan time.Duration, limit int) ([]OrphanedJob, error)
	// MarkJobRecovered updates the job's status and increments recovery count.
	MarkJobRecovered(ctx context.Context, jobID string) error
	// ResetJobToQueued resets a job back to queued status for retry.
	ResetJobToQueued(ctx context.Context, jobID string) error
	// MarkJobExhausted marks a job as exhausted (max recovery attempts reached).
	MarkJobExhausted(ctx context.Context, jobID string) error
}

type jobRecoveryStore struct {
	db *DB
}

func newJobRecoveryStore(db *DB) *jobRecoveryStore {
	return &jobRecoveryStore{db: db}
}

// FindOrphanedJobs returns jobs that have been in 'queued' status longer than the threshold.
// Skips jobs with empty or invalid payloads. Returns at most 'limit' jobs to prevent recovery floods.
// Jobs that have exceeded MaxRecoveryAttempts are excluded (they should be marked as exhausted).
func (s *jobRecoveryStore) FindOrphanedJobs(ctx context.Context, olderThan time.Duration, limit int) ([]OrphanedJob, error) {
	query := `
		SELECT id, type, payload, COALESCE(recovery_count, 0) as recovery_count
		FROM jobs
		WHERE status = 'queued'
		AND created_at < NOW() - $1::interval
		AND COALESCE(recovery_count, 0) < $2
		AND payload IS NOT NULL
		AND payload::text != '{}'
		AND payload::text != ''
		AND jsonb_typeof(payload) = 'object'
		AND payload ? 'account_id'
		ORDER BY created_at ASC
		LIMIT $3
	`

	rows, err := s.db.Pool().Query(ctx, query, olderThan.String(), MaxRecoveryAttempts, limit)
	if err != nil {
		return nil, fmt.Errorf("query orphaned jobs: %w", err)
	}
	defer rows.Close()

	var jobs []OrphanedJob
	for rows.Next() {
		var job OrphanedJob
		var jobType string
		if err := rows.Scan(&job.ID, &jobType, &job.Payload, &job.RecoveryCount); err != nil {
			return nil, fmt.Errorf("scan orphaned job: %w", err)
		}
		job.Type = models.JobType(jobType)
		jobs = append(jobs, job)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate orphaned jobs: %w", err)
	}

	return jobs, nil
}

// MarkJobRecovered updates the job status to 'running' and increments recovery count.
// If the job fails, it will go to dead_letter_jobs and stay with 'running' status.
func (s *jobRecoveryStore) MarkJobRecovered(ctx context.Context, jobID string) error {
	query := `
		UPDATE jobs
		SET status = 'running', started_at = NOW(), recovery_count = COALESCE(recovery_count, 0) + 1
		WHERE id = $1
	`

	_, err := s.db.Pool().Exec(ctx, query, jobID)
	if err != nil {
		return fmt.Errorf("mark job recovered: %w", err)
	}

	return nil
}

// FindStuckRunningJobs returns jobs that have been in 'running' status longer than the threshold.
// This catches jobs where the worker crashed mid-processing. Returns at most 'limit' jobs.
// Jobs that have exceeded MaxRecoveryAttempts are excluded.
func (s *jobRecoveryStore) FindStuckRunningJobs(ctx context.Context, olderThan time.Duration, limit int) ([]OrphanedJob, error) {
	query := `
		SELECT id, type, payload, COALESCE(recovery_count, 0) as recovery_count
		FROM jobs
		WHERE status = 'running'
		AND started_at < NOW() - $1::interval
		AND COALESCE(recovery_count, 0) < $2
		AND payload IS NOT NULL
		AND payload::text != '{}'
		AND payload::text != ''
		AND jsonb_typeof(payload) = 'object'
		AND payload ? 'account_id'
		ORDER BY started_at ASC
		LIMIT $3
	`

	rows, err := s.db.Pool().Query(ctx, query, olderThan.String(), MaxRecoveryAttempts, limit)
	if err != nil {
		return nil, fmt.Errorf("query stuck running jobs: %w", err)
	}
	defer rows.Close()

	var jobs []OrphanedJob
	for rows.Next() {
		var job OrphanedJob
		var jobType string
		if err := rows.Scan(&job.ID, &jobType, &job.Payload, &job.RecoveryCount); err != nil {
			return nil, fmt.Errorf("scan stuck running job: %w", err)
		}
		job.Type = models.JobType(jobType)
		jobs = append(jobs, job)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate stuck running jobs: %w", err)
	}

	return jobs, nil
}

// ResetJobToQueued resets a job back to queued status for retry.
func (s *jobRecoveryStore) ResetJobToQueued(ctx context.Context, jobID string) error {
	query := `
		UPDATE jobs
		SET status = 'queued', started_at = NULL, error = NULL
		WHERE id = $1
	`

	_, err := s.db.Pool().Exec(ctx, query, jobID)
	if err != nil {
		return fmt.Errorf("reset job to queued: %w", err)
	}

	return nil
}

// MarkJobExhausted marks a job as having exceeded max recovery attempts.
// The job will be marked as 'error' with a descriptive message.
func (s *jobRecoveryStore) MarkJobExhausted(ctx context.Context, jobID string) error {
	query := `
		UPDATE jobs
		SET status = 'error', error = 'max recovery attempts exceeded', completed_at = NOW()
		WHERE id = $1
	`

	_, err := s.db.Pool().Exec(ctx, query, jobID)
	if err != nil {
		return fmt.Errorf("mark job exhausted: %w", err)
	}

	return nil
}

// FindExhaustedJobs returns jobs that have exceeded max recovery attempts but are still not marked as error.
// This is a cleanup function to catch any jobs that slipped through.
func (s *jobRecoveryStore) FindExhaustedJobs(ctx context.Context, limit int) ([]OrphanedJob, error) {
	query := `
		SELECT id, type, payload, COALESCE(recovery_count, 0) as recovery_count
		FROM jobs
		WHERE status IN ('queued', 'running')
		AND COALESCE(recovery_count, 0) >= $1
		LIMIT $2
	`

	rows, err := s.db.Pool().Query(ctx, query, MaxRecoveryAttempts, limit)
	if err != nil {
		return nil, fmt.Errorf("query exhausted jobs: %w", err)
	}
	defer rows.Close()

	var jobs []OrphanedJob
	for rows.Next() {
		var job OrphanedJob
		var jobType string
		if err := rows.Scan(&job.ID, &jobType, &job.Payload, &job.RecoveryCount); err != nil {
			return nil, fmt.Errorf("scan exhausted job: %w", err)
		}
		job.Type = models.JobType(jobType)
		jobs = append(jobs, job)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate exhausted jobs: %w", err)
	}

	return jobs, nil
}
