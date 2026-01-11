package queue

import (
	"context"
	"crypto/tls"
	"fmt"
	"strings"
	"time"

	"github.com/maxbolgarin/scanorbit/internal/models"
	"github.com/redis/go-redis/v9"
	"github.com/rs/zerolog"
)

const (
	jobKeyPrefix = "jobs:"
	blpopTimeout = 5 * time.Second
)

// RedisQueue implements Queue using Redis.
type RedisQueue struct {
	client *redis.Client
	logger zerolog.Logger
}

// NewRedisQueue creates a new Redis-based job queue.
func NewRedisQueue(redisURL string, logger zerolog.Logger) (*RedisQueue, error) {
	opts, err := redis.ParseURL(redisURL)
	if err != nil {
		return nil, fmt.Errorf("parse redis URL: %w", err)
	}

	// Accept self-signed certificates for internal TLS
	if strings.HasPrefix(redisURL, "rediss://") {
		opts.TLSConfig = &tls.Config{
			InsecureSkipVerify: true,
		}
	}

	client := redis.NewClient(opts)

	// Verify connection
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := client.Ping(ctx).Err(); err != nil {
		return nil, fmt.Errorf("ping redis: %w", err)
	}

	return &RedisQueue{
		client: client,
		logger: logger.With().Str("component", "redis_queue").Logger(),
	}, nil
}

// Enqueue adds a job to the queue.
func (q *RedisQueue) Enqueue(ctx context.Context, jobType models.JobType, payload []byte) error {
	key := jobKeyPrefix + string(jobType)
	if err := q.client.RPush(ctx, key, payload).Err(); err != nil {
		return fmt.Errorf("rpush: %w", err)
	}
	q.logger.Debug().Str("job_type", string(jobType)).Msg("job enqueued")
	return nil
}

// Consume starts consuming jobs from the queue.
func (q *RedisQueue) Consume(ctx context.Context, jobTypes []models.JobType, handler Handler) error {
	keys := make([]string, len(jobTypes))
	for i, jt := range jobTypes {
		keys[i] = jobKeyPrefix + string(jt)
	}

	q.logger.Info().Strs("queues", keys).Msg("starting job consumer")

	for {
		select {
		case <-ctx.Done():
			q.logger.Info().Msg("job consumer stopped")
			return ctx.Err()
		default:
		}

		// BLPOP with timeout
		result, err := q.client.BLPop(ctx, blpopTimeout, keys...).Result()
		if err == redis.Nil {
			// Timeout, no job available, retry
			continue
		}
		if err != nil {
			if ctx.Err() != nil {
				return ctx.Err()
			}
			q.logger.Error().Err(err).Msg("redis blpop error")
			time.Sleep(time.Second) // Backoff on error
			continue
		}

		// result[0] is the key, result[1] is the value
		jobType := models.JobType(strings.TrimPrefix(result[0], jobKeyPrefix))
		job := &Job{
			Type:    jobType,
			Payload: []byte(result[1]),
		}

		q.logger.Debug().Str("job_type", string(jobType)).Msg("processing job")

		if err := handler(ctx, job); err != nil {
			q.logger.Error().Err(err).Str("job_type", string(jobType)).Msg("job handler error, re-enqueueing")
			// Simple retry: re-enqueue the job
			if enqErr := q.Enqueue(ctx, job.Type, job.Payload); enqErr != nil {
				q.logger.Error().Err(enqErr).Msg("failed to re-enqueue job")
			}
		}
	}
}

// Ping verifies the Redis connection is alive.
func (q *RedisQueue) Ping(ctx context.Context) error {
	return q.client.Ping(ctx).Err()
}

// Close closes the Redis connection.
func (q *RedisQueue) Close() error {
	return q.client.Close()
}
