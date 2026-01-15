package store

import (
	"context"
	"fmt"
	"time"

	"github.com/maxbolgarin/scanorbit/internal/models"
)

// JobStore defines operations for jobs.
type JobStore interface {
	// Create creates a new job record and returns the job ID.
	Create(ctx context.Context, job *Job) (string, error)
	UpdateStatus(ctx context.Context, id string, status models.JobStatus, errorMsg string) error
	MarkRunning(ctx context.Context, id string) error
	MarkComplete(ctx context.Context, id string) error
	MarkError(ctx context.Context, id, errorMsg string) error
	// CountIncompleteAnalyzerJobsForScan returns count of analyzer jobs not yet complete/error for a scan.
	CountIncompleteAnalyzerJobsForScan(ctx context.Context, scanID string) (int, error)
}

type jobStore struct {
	db *DB
}

func newJobStore(db *DB) *jobStore {
	return &jobStore{db: db}
}

// UpdateStatus updates the job status with optional error message.
func (s *jobStore) UpdateStatus(ctx context.Context, id string, status models.JobStatus, errorMsg string) error {
	if id == "" {
		return nil // Skip if no job ID (backwards compatibility)
	}

	var completedAt *time.Time
	if status == models.JobStatusComplete || status == models.JobStatusError {
		now := time.Now()
		completedAt = &now
	}

	var startedAt *time.Time
	if status == models.JobStatusRunning {
		now := time.Now()
		startedAt = &now
	}

	query := `
		UPDATE jobs
		SET status = $2, error = $3, started_at = COALESCE($4, started_at), completed_at = $5
		WHERE id = $1
	`

	_, err := s.db.Pool().Exec(ctx, query, id, string(status), errorMsg, startedAt, completedAt)
	if err != nil {
		return fmt.Errorf("update job status: %w", err)
	}

	return nil
}

// MarkRunning marks a job as running.
func (s *jobStore) MarkRunning(ctx context.Context, id string) error {
	return s.UpdateStatus(ctx, id, models.JobStatusRunning, "")
}

// MarkComplete marks a job as complete.
func (s *jobStore) MarkComplete(ctx context.Context, id string) error {
	return s.UpdateStatus(ctx, id, models.JobStatusComplete, "")
}

// MarkError marks a job as failed with an error message.
func (s *jobStore) MarkError(ctx context.Context, id, errorMsg string) error {
	return s.UpdateStatus(ctx, id, models.JobStatusError, errorMsg)
}

// Create creates a new job record and returns the job ID.
func (s *jobStore) Create(ctx context.Context, job *Job) (string, error) {
	query := `
		INSERT INTO jobs (type, scan_id, payload, status, created_at)
		VALUES ($1, $2, $3, $4, NOW())
		RETURNING id
	`

	var id string
	err := s.db.Pool().QueryRow(ctx, query, job.Type, job.ScanID, job.Payload, job.Status).Scan(&id)
	if err != nil {
		return "", fmt.Errorf("create job: %w", err)
	}

	return id, nil
}

// CountIncompleteAnalyzerJobsForScan returns count of analyzer jobs not yet complete/error for a scan.
func (s *jobStore) CountIncompleteAnalyzerJobsForScan(ctx context.Context, scanID string) (int, error) {
	if scanID == "" {
		return 0, nil
	}

	query := `
		SELECT COUNT(*)
		FROM jobs
		WHERE scan_id = $1
		AND type LIKE 'analyze_%'
		AND status NOT IN ('complete', 'error')
	`

	var count int
	err := s.db.Pool().QueryRow(ctx, query, scanID).Scan(&count)
	if err != nil {
		return 0, fmt.Errorf("count incomplete analyzer jobs: %w", err)
	}

	return count, nil
}
