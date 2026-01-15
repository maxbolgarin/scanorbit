package store

import (
	"context"
	"fmt"
	"time"

	"github.com/maxbolgarin/scanorbit/internal/models"
)

// OrphanedJob represents a job stuck in queued state.
type OrphanedJob struct {
	ID      string
	Type    models.JobType
	Payload []byte
}

// JobRecoveryStore defines operations for recovering orphaned jobs.
type JobRecoveryStore interface {
	// FindOrphanedJobs returns jobs that have been in 'queued' status longer than the threshold.
	FindOrphanedJobs(ctx context.Context, olderThan time.Duration) ([]OrphanedJob, error)
	// FindStuckRunningJobs returns jobs that have been in 'running' status longer than the threshold.
	// This catches jobs where the worker crashed mid-processing.
	FindStuckRunningJobs(ctx context.Context, olderThan time.Duration) ([]OrphanedJob, error)
	// MarkJobRecovered updates the job's created_at to prevent re-recovery.
	MarkJobRecovered(ctx context.Context, jobID string) error
	// ResetJobToQueued resets a job back to queued status for retry.
	ResetJobToQueued(ctx context.Context, jobID string) error
}

type jobRecoveryStore struct {
	db *DB
}

func newJobRecoveryStore(db *DB) *jobRecoveryStore {
	return &jobRecoveryStore{db: db}
}

// FindOrphanedJobs returns jobs that have been in 'queued' status longer than the threshold.
// Skips jobs with empty or invalid payloads.
func (s *jobRecoveryStore) FindOrphanedJobs(ctx context.Context, olderThan time.Duration) ([]OrphanedJob, error) {
	query := `
		SELECT id, type, payload
		FROM jobs
		WHERE status = 'queued'
		AND created_at < NOW() - $1::interval
		AND payload IS NOT NULL
		AND payload::text != '{}'
		AND payload::text != ''
		AND jsonb_typeof(payload) = 'object'
		AND payload ? 'account_id'
	`

	rows, err := s.db.Pool().Query(ctx, query, olderThan.String())
	if err != nil {
		return nil, fmt.Errorf("query orphaned jobs: %w", err)
	}
	defer rows.Close()

	var jobs []OrphanedJob
	for rows.Next() {
		var job OrphanedJob
		var jobType string
		if err := rows.Scan(&job.ID, &jobType, &job.Payload); err != nil {
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

// MarkJobRecovered updates the job status to 'running' so it won't be recovered again.
// If the job fails, it will go to dead_letter_jobs and stay with 'running' status.
func (s *jobRecoveryStore) MarkJobRecovered(ctx context.Context, jobID string) error {
	query := `
		UPDATE jobs
		SET status = 'running', started_at = NOW()
		WHERE id = $1
	`

	_, err := s.db.Pool().Exec(ctx, query, jobID)
	if err != nil {
		return fmt.Errorf("mark job recovered: %w", err)
	}

	return nil
}

// FindStuckRunningJobs returns jobs that have been in 'running' status longer than the threshold.
// This catches jobs where the worker crashed mid-processing.
func (s *jobRecoveryStore) FindStuckRunningJobs(ctx context.Context, olderThan time.Duration) ([]OrphanedJob, error) {
	query := `
		SELECT id, type, payload
		FROM jobs
		WHERE status = 'running'
		AND started_at < NOW() - $1::interval
		AND payload IS NOT NULL
		AND payload::text != '{}'
		AND payload::text != ''
		AND jsonb_typeof(payload) = 'object'
		AND payload ? 'account_id'
	`

	rows, err := s.db.Pool().Query(ctx, query, olderThan.String())
	if err != nil {
		return nil, fmt.Errorf("query stuck running jobs: %w", err)
	}
	defer rows.Close()

	var jobs []OrphanedJob
	for rows.Next() {
		var job OrphanedJob
		var jobType string
		if err := rows.Scan(&job.ID, &jobType, &job.Payload); err != nil {
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
