//go:build integration

package queue

import (
	"context"
	"encoding/json"
	"errors"
	"os"
	"sync"
	"testing"
	"time"

	"github.com/maxbolgarin/scanorbit/internal/models"
	"github.com/maxbolgarin/scanorbit/internal/testutil"
	"github.com/redis/go-redis/v9"
	"github.com/rs/zerolog"
)

var testClient *redis.Client

func TestMain(m *testing.M) {
	testutil.InitMetrics()

	redisURL := os.Getenv("REDIS_URL")
	if redisURL == "" {
		// Without REDIS_URL, tests will be skipped
		os.Exit(0)
	}

	opts, err := redis.ParseURL(redisURL)
	if err != nil {
		panic("parse redis URL: " + err.Error())
	}
	testClient = redis.NewClient(opts)

	if err := testClient.Ping(context.Background()).Err(); err != nil {
		panic("ping redis: " + err.Error())
	}

	code := m.Run()
	testClient.Close()
	os.Exit(code)
}

func flushRedis(t *testing.T) {
	t.Helper()
	if err := testClient.FlushDB(context.Background()).Err(); err != nil {
		t.Fatalf("flushdb: %v", err)
	}
}

func newTestQueue(t *testing.T) *RedisQueue {
	t.Helper()
	redisURL := os.Getenv("REDIS_URL")
	q, err := NewRedisQueue(redisURL, "", zerolog.Nop())
	if err != nil {
		t.Fatalf("NewRedisQueue: %v", err)
	}
	t.Cleanup(func() { q.Close() })
	return q
}

func TestEnqueueAndConsume(t *testing.T) {
	flushRedis(t)
	q := newTestQueue(t)

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	payload := []byte(`{"account_id": "123"}`)
	if err := q.Enqueue(ctx, models.JobTypeAnalyzeOrphans, payload); err != nil {
		t.Fatalf("Enqueue: %v", err)
	}

	var received *Job
	var mu sync.Mutex
	done := make(chan struct{})

	handler := func(ctx context.Context, job *Job) error {
		mu.Lock()
		received = job
		mu.Unlock()
		close(done)
		cancel() // stop consuming after first job
		return nil
	}

	go func() {
		_ = q.Consume(ctx, []models.JobType{models.JobTypeAnalyzeOrphans}, handler, nil)
	}()

	select {
	case <-done:
	case <-time.After(10 * time.Second):
		t.Fatal("timeout waiting for job to be consumed")
	}

	mu.Lock()
	defer mu.Unlock()

	if received == nil {
		t.Fatal("no job received")
	}
	if received.Type != models.JobTypeAnalyzeOrphans {
		t.Errorf("type = %q, want %q", received.Type, models.JobTypeAnalyzeOrphans)
	}
	if !json.Valid(received.Payload) {
		t.Errorf("invalid payload: %s", received.Payload)
	}
}

func TestRetryOnHandlerError(t *testing.T) {
	flushRedis(t)
	q := newTestQueue(t)

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	payload := []byte(`{"test": "retry"}`)
	if err := q.Enqueue(ctx, models.JobTypeAnalyzeSecurity, payload); err != nil {
		t.Fatalf("Enqueue: %v", err)
	}

	var mu sync.Mutex
	var attempts int
	var deadLetterCalled bool
	done := make(chan struct{})

	handler := func(ctx context.Context, job *Job) error {
		mu.Lock()
		attempts++
		current := attempts
		mu.Unlock()

		// Fail every time
		if current > maxRetries+1 {
			// Safety: shouldn't get here
			cancel()
		}
		return errors.New("handler error")
	}

	deadLetterHandler := func(ctx context.Context, job *Job, err error) {
		mu.Lock()
		deadLetterCalled = true
		mu.Unlock()
		close(done)
		cancel()
	}

	go func() {
		_ = q.Consume(ctx, []models.JobType{models.JobTypeAnalyzeSecurity}, handler, deadLetterHandler)
	}()

	select {
	case <-done:
	case <-time.After(25 * time.Second):
		t.Fatal("timeout waiting for dead letter handler")
	}

	mu.Lock()
	defer mu.Unlock()

	if !deadLetterCalled {
		t.Error("dead letter handler was not called")
	}
	// Initial attempt (retry=0) + 3 retries (retry=1,2,3) = 4 total handler calls
	if attempts != maxRetries+1 {
		t.Errorf("attempts = %d, want %d", attempts, maxRetries+1)
	}
}

func TestConsumeContextCancellation(t *testing.T) {
	flushRedis(t)
	q := newTestQueue(t)

	ctx, cancel := context.WithCancel(context.Background())

	done := make(chan error, 1)
	go func() {
		done <- q.Consume(ctx, []models.JobType{models.JobTypeAnalyzeOrphans}, func(ctx context.Context, job *Job) error {
			return nil
		}, nil)
	}()

	// Give consumer time to start, then cancel
	time.Sleep(100 * time.Millisecond)
	cancel()

	select {
	case err := <-done:
		if !errors.Is(err, context.Canceled) {
			t.Errorf("expected context.Canceled, got %v", err)
		}
	case <-time.After(10 * time.Second):
		t.Fatal("timeout waiting for consumer to stop")
	}
}

func TestConsumeMultipleJobTypes(t *testing.T) {
	flushRedis(t)
	q := newTestQueue(t)

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	// Enqueue two different job types
	if err := q.Enqueue(ctx, models.JobTypeAnalyzeOrphans, []byte(`{"type":"orphans"}`)); err != nil {
		t.Fatal(err)
	}
	if err := q.Enqueue(ctx, models.JobTypeAnalyzeCost, []byte(`{"type":"cost"}`)); err != nil {
		t.Fatal(err)
	}

	var mu sync.Mutex
	receivedTypes := make(map[models.JobType]bool)
	done := make(chan struct{})

	handler := func(ctx context.Context, job *Job) error {
		mu.Lock()
		receivedTypes[job.Type] = true
		if len(receivedTypes) == 2 {
			close(done)
			cancel()
		}
		mu.Unlock()
		return nil
	}

	go func() {
		_ = q.Consume(ctx, []models.JobType{models.JobTypeAnalyzeOrphans, models.JobTypeAnalyzeCost}, handler, nil)
	}()

	select {
	case <-done:
	case <-time.After(10 * time.Second):
		t.Fatal("timeout waiting for both jobs")
	}

	mu.Lock()
	defer mu.Unlock()

	if !receivedTypes[models.JobTypeAnalyzeOrphans] {
		t.Error("orphans job not received")
	}
	if !receivedTypes[models.JobTypeAnalyzeCost] {
		t.Error("cost job not received")
	}
}
