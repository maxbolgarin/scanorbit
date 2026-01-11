package queue

import (
	"context"
	"crypto/tls"
	"crypto/x509"
	"encoding/json"
	"fmt"
	"os"
	"strings"
	"time"

	"github.com/maxbolgarin/scanorbit/internal/models"
	"github.com/redis/go-redis/v9"
	"github.com/rs/zerolog"
)

const (
	jobKeyPrefix = "jobs:"
	blpopTimeout = 5 * time.Second
	maxRetries   = 3
)

// jobEnvelope wraps payload with retry metadata for Redis storage.
type jobEnvelope struct {
	Payload    []byte `json:"payload"`
	RetryCount int    `json:"retry_count"`
}

// RedisQueue implements Queue using Redis.
type RedisQueue struct {
	client *redis.Client
	logger zerolog.Logger
}

// NewRedisQueue creates a new Redis-based job queue.
// If caCertPath is provided and the URL uses rediss://, the CA certificate will be used for TLS verification.
func NewRedisQueue(redisURL, caCertPath string, logger zerolog.Logger) (*RedisQueue, error) {
	opts, err := redis.ParseURL(redisURL)
	if err != nil {
		return nil, fmt.Errorf("parse redis URL: %w", err)
	}

	// Configure TLS for rediss:// URLs
	if strings.HasPrefix(redisURL, "rediss://") {
		tlsConfig := &tls.Config{}
		if caCertPath != "" {
			caCert, err := os.ReadFile(caCertPath)
			if err != nil {
				return nil, fmt.Errorf("read CA cert: %w", err)
			}
			certPool := x509.NewCertPool()
			if !certPool.AppendCertsFromPEM(caCert) {
				return nil, fmt.Errorf("failed to parse CA certificate")
			}
			tlsConfig.RootCAs = certPool
		}
		opts.TLSConfig = tlsConfig
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
	return q.enqueueWithRetry(ctx, jobType, payload, 0)
}

// enqueueWithRetry adds a job to the queue with a specific retry count.
func (q *RedisQueue) enqueueWithRetry(ctx context.Context, jobType models.JobType, payload []byte, retryCount int) error {
	envelope := jobEnvelope{
		Payload:    payload,
		RetryCount: retryCount,
	}
	data, err := json.Marshal(envelope)
	if err != nil {
		return fmt.Errorf("marshal envelope: %w", err)
	}

	key := jobKeyPrefix + string(jobType)
	if err := q.client.RPush(ctx, key, data).Err(); err != nil {
		return fmt.Errorf("rpush: %w", err)
	}
	q.logger.Debug().Str("job_type", string(jobType)).Int("retry_count", retryCount).Msg("job enqueued")
	return nil
}

// Consume starts consuming jobs from the queue.
func (q *RedisQueue) Consume(ctx context.Context, jobTypes []models.JobType, handler Handler, deadLetterHandler DeadLetterHandler) error {
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

		// Parse envelope to get retry count
		var envelope jobEnvelope
		if err := json.Unmarshal([]byte(result[1]), &envelope); err != nil {
			// Fallback for old format without envelope
			envelope = jobEnvelope{
				Payload:    []byte(result[1]),
				RetryCount: 0,
			}
		}

		job := &Job{
			Type:       jobType,
			Payload:    envelope.Payload,
			RetryCount: envelope.RetryCount,
		}

		q.logger.Debug().
			Str("job_type", string(jobType)).
			Int("retry_count", job.RetryCount).
			Msg("processing job")

		if err := handler(ctx, job); err != nil {
			if job.RetryCount >= maxRetries {
				q.logger.Error().
					Err(err).
					Str("job_type", string(jobType)).
					Int("retry_count", job.RetryCount).
					Msg("job failed after max retries, sending to dead letter")

				if deadLetterHandler != nil {
					deadLetterHandler(ctx, job, err)
				}
				continue
			}

			q.logger.Warn().
				Err(err).
				Str("job_type", string(jobType)).
				Int("retry_count", job.RetryCount).
				Msg("job handler error, re-enqueueing with incremented retry count")

			if enqErr := q.enqueueWithRetry(ctx, job.Type, job.Payload, job.RetryCount+1); enqErr != nil {
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
