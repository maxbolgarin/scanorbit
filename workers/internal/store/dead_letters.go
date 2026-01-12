package store

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
)

// DeadLetterJob represents a job that failed after max retries.
type DeadLetterJob struct {
	ID        string
	JobType   string
	Payload   []byte
	Error     string
	Retries   int
	CreatedAt time.Time
}

// DeadLetterStore defines operations for dead letter jobs.
type DeadLetterStore interface {
	Create(ctx context.Context, job *DeadLetterJob) error
}

type deadLetterStore struct {
	db *DB
}

func newDeadLetterStore(db *DB) *deadLetterStore {
	return &deadLetterStore{db: db}
}

// Create stores a failed job in the dead letter table.
func (s *deadLetterStore) Create(ctx context.Context, job *DeadLetterJob) error {
	if job.ID == "" {
		job.ID = uuid.New().String()
	}

	// Ensure payload is never nil - use empty JSON object if nil
	payload := job.Payload
	if payload == nil {
		payload = []byte("{}")
	}

	query := `
		INSERT INTO dead_letter_jobs (id, job_type, payload, error, retries, created_at)
		VALUES ($1, $2, $3, $4, $5, NOW())
	`

	_, err := s.db.Pool().Exec(ctx, query,
		job.ID,
		job.JobType,
		payload,
		job.Error,
		job.Retries,
	)
	if err != nil {
		return fmt.Errorf("insert dead letter job: %w", err)
	}

	return nil
}
