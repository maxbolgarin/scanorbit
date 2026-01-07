package queue

import (
	"context"

	"github.com/maxbolgarin/scanorbit/internal/models"
)

// Job represents a job from the queue.
type Job struct {
	Type    models.JobType
	Payload []byte
}

// Handler is a function that processes a job.
type Handler func(ctx context.Context, job *Job) error

// Queue defines the interface for a job queue.
type Queue interface {
	// Enqueue adds a job to the queue.
	Enqueue(ctx context.Context, jobType models.JobType, payload []byte) error

	// Consume starts consuming jobs from the queue.
	// It blocks until the context is cancelled.
	Consume(ctx context.Context, jobTypes []models.JobType, handler Handler) error

	// Ping verifies the queue connection is alive.
	Ping(ctx context.Context) error

	// Close closes the queue connection.
	Close() error
}
