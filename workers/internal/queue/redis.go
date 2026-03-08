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

	"github.com/maxbolgarin/scanorbit/internal/metrics"
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
	client    *redis.Client
	logger    zerolog.Logger
	stopCh    chan struct{} // Channel to signal metrics goroutine to stop
	stoppedCh chan struct{} // Channel to signal metrics goroutine has stopped
}

// NewRedisQueue creates a new Redis-based job queue.
// If the URL uses rediss://, CA certificate is required for secure TLS verification.
func NewRedisQueue(redisURL, caCertPath string, logger zerolog.Logger) (*RedisQueue, error) {
	opts, err := redis.ParseURL(redisURL)
	if err != nil {
		return nil, fmt.Errorf("parse redis URL: %w", err)
	}

	// Configure TLS for rediss:// URLs - require CA certificate for security
	if strings.HasPrefix(redisURL, "rediss://") {
		if caCertPath == "" {
			return nil, fmt.Errorf("CA certificate path is required for TLS connections (rediss://)")
		}

		caCert, err := os.ReadFile(caCertPath)
		if err != nil {
			return nil, fmt.Errorf("read CA cert: %w", err)
		}
		certPool := x509.NewCertPool()
		if !certPool.AppendCertsFromPEM(caCert) {
			return nil, fmt.Errorf("failed to parse CA certificate")
		}

		tlsConfig := &tls.Config{
			RootCAs:            certPool,
			InsecureSkipVerify: false, // Explicitly enforce certificate verification
			MinVersion:         tls.VersionTLS13,
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

	rq := &RedisQueue{
		client:    client,
		logger:    logger.With().Str("component", "redis_queue").Logger(),
		stopCh:    make(chan struct{}),
		stoppedCh: make(chan struct{}),
	}

	// Start background goroutine to track queue length
	go rq.trackQueueMetrics()

	return rq, nil
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

	q.logger.Debug().Str("job_type", string(jobType)).Int("retry_count", retryCount).Msg("job enqueued")
	finish := metrics.TrackRedisOperation("rpush")

	key := jobKeyPrefix + string(jobType)
	if err := q.client.RPush(ctx, key, data).Err(); err != nil {
		finish("error")
		return fmt.Errorf("rpush: %w", err)
	}

	finish("success")
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

		// Parse envelope to get retry count
		var envelope jobEnvelope
		rawData := []byte(result[1])
		if err := json.Unmarshal(rawData, &envelope); err != nil || len(envelope.Payload) == 0 {
			// Fallback for plain JSON format (from API) or old format without envelope
			// If unmarshal succeeded but Payload is empty, the JSON wasn't an envelope
			envelope = jobEnvelope{
				Payload:    rawData,
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

// Close closes the Redis connection and stops background goroutines.
func (q *RedisQueue) Close() error {
	// Signal metrics goroutine to stop
	close(q.stopCh)

	// Wait for metrics goroutine to stop (with timeout)
	select {
	case <-q.stoppedCh:
		q.logger.Debug().Msg("metrics goroutine stopped cleanly")
	case <-time.After(5 * time.Second):
		q.logger.Warn().Msg("metrics goroutine did not stop within timeout")
	}

	return q.client.Close()
}

// trackQueueMetrics periodically tracks queue length metrics.
// Gracefully stops when stopCh is closed.
func (q *RedisQueue) trackQueueMetrics() {
	defer close(q.stoppedCh)

	ticker := time.NewTicker(15 * time.Second)
	defer ticker.Stop()

	queueNames := []string{
		string(models.JobTypeScanAccount),
		string(models.JobTypeAnalyzeOrphans),
		string(models.JobTypeAnalyzeSSL),
		string(models.JobTypeAnalyzeSecurity),
		string(models.JobTypeAnalyzeResidency),
		string(models.JobTypeAnalyzeCost),
		string(models.JobTypeAnalyzeTagging),
		string(models.JobTypeAnalyzeIAM),
	}

	for {
		select {
		case <-q.stopCh:
			q.logger.Debug().Msg("queue metrics tracking stopped")
			return
		case <-ticker.C:
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
}
