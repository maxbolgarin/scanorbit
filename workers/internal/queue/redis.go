package queue

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/maxbolgarin/scanorbit/internal/metrics"
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

	client := redis.NewClient(opts)

	// Verify connection
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := client.Ping(ctx).Err(); err != nil {
		return nil, fmt.Errorf("ping redis: %w", err)
	}

	rq := &RedisQueue{
		client: client,
		logger: logger.With().Str("component", "redis_queue").Logger(),
	}

	// Start background goroutine to track queue length
	go rq.trackQueueMetrics()

	return rq, nil
}

// Enqueue adds a job to the queue.
func (q *RedisQueue) Enqueue(ctx context.Context, jobType models.JobType, payload []byte) error {
	finish := metrics.TrackRedisOperation("rpush")

	key := jobKeyPrefix + string(jobType)
	if err := q.client.RPush(ctx, key, payload).Err(); err != nil {
		finish("error")
		return fmt.Errorf("rpush: %w", err)
	}

	finish("success")
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
		finish := metrics.TrackRedisOperation("blpop")
		result, err := q.client.BLPop(ctx, blpopTimeout, keys...).Result()
		if err == redis.Nil {
			finish("timeout")
			// Timeout, no job available, retry
			continue
		}
		if err != nil {
			finish("error")
			if ctx.Err() != nil {
				return ctx.Err()
			}
			q.logger.Error().Err(err).Msg("redis blpop error")
			time.Sleep(time.Second) // Backoff on error
			continue
		}
		finish("success")

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

// trackQueueMetrics periodically tracks queue length metrics.
func (q *RedisQueue) trackQueueMetrics() {
	ticker := time.NewTicker(15 * time.Second)
	defer ticker.Stop()

	queueNames := []string{
		string(models.JobTypeScanAccount),
		string(models.JobTypeAnalyzeOrphans),
		string(models.JobTypeAnalyzeSSL),
		string(models.JobTypeAnalyzeSecurity),
	}

	for range ticker.C {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)

		for _, queueName := range queueNames {
			key := jobKeyPrefix + queueName
			length, err := q.client.LLen(ctx, key).Result()
			if err != nil {
				q.logger.Warn().Err(err).Str("queue", queueName).Msg("failed to get queue length")
				continue
			}
			metrics.QueueLength.WithLabelValues(queueName).Set(float64(length))
		}

		cancel()
	}
}
