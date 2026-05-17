//go:build integration

package testutil

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/maxbolgarin/scanorbit/internal/metrics"
	"github.com/redis/go-redis/v9"
	"github.com/testcontainers/testcontainers-go"
	tcpostgres "github.com/testcontainers/testcontainers-go/modules/postgres"
	tcredis "github.com/testcontainers/testcontainers-go/modules/redis"
	"github.com/testcontainers/testcontainers-go/wait"
)

// InitMetrics initializes metrics for integration tests (idempotent via sync.Once inside).
func InitMetrics() {
	metrics.Init(metrics.Config{
		ServiceName: "integration-test",
		Environment: "test",
		Version:     "0.0.0",
	})
}

// SetupPostgres returns a PostgreSQL connection URL and a *pgxpool.Pool.
// If DATABASE_URL is set, connects directly (CI). Otherwise, starts a testcontainer.
// Applies all SQL migrations before returning.
func SetupPostgres(t *testing.T) (string, *pgxpool.Pool) {
	t.Helper()
	ctx := context.Background()

	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		dbURL = startPostgresContainer(t, ctx)
	}

	pool, err := pgxpool.New(ctx, dbURL)
	if err != nil {
		t.Fatalf("pgxpool.New: %v", err)
	}

	applyMigrations(t, ctx, pool)

	t.Cleanup(func() { pool.Close() })
	return dbURL, pool
}

// SetupRedis returns a *redis.Client connected to a test Redis.
// If REDIS_URL is set, connects directly (CI). Otherwise, starts a testcontainer.
func SetupRedis(t *testing.T) *redis.Client {
	t.Helper()
	ctx := context.Background()

	redisURL := os.Getenv("REDIS_URL")
	if redisURL == "" {
		redisURL = startRedisContainer(t, ctx)
	}

	opts, err := redis.ParseURL(redisURL)
	if err != nil {
		t.Fatalf("parse redis URL: %v", err)
	}
	client := redis.NewClient(opts)

	if err := client.Ping(ctx).Err(); err != nil {
		t.Fatalf("ping redis: %v", err)
	}

	t.Cleanup(func() { client.Close() })
	return client
}

// TruncateAll truncates all worker-related tables for test isolation.
func TruncateAll(t *testing.T, pool *pgxpool.Pool) {
	t.Helper()
	ctx := context.Background()

	_, err := pool.Exec(ctx, `
		TRUNCATE
			finding_scans, resource_scans, resource_dependencies,
			dead_letter_jobs, findings, certificates, resources,
			jobs, scans, aws_accounts, orgs
		CASCADE
	`)
	if err != nil {
		t.Fatalf("truncate tables: %v", err)
	}
}

// SeedTestOrg inserts a test org and returns its ID.
func SeedTestOrg(t *testing.T, pool *pgxpool.Pool) string {
	t.Helper()
	var id string
	err := pool.QueryRow(context.Background(),
		`INSERT INTO orgs (name, slug, tier) VALUES ('Test Org', 'test-org', 'free') RETURNING id`,
	).Scan(&id)
	if err != nil {
		t.Fatalf("seed org: %v", err)
	}
	return id
}

// SeedTestAccount inserts a test AWS account and returns its ID.
func SeedTestAccount(t *testing.T, pool *pgxpool.Pool, orgID string) string {
	t.Helper()
	var id string
	err := pool.QueryRow(context.Background(),
		`INSERT INTO aws_accounts (org_id, name, aws_account_id, role_arn, status)
		 VALUES ($1, 'Test Account', '123456789012', 'arn:aws:iam::123456789012:role/test', 'pending')
		 RETURNING id`,
		orgID,
	).Scan(&id)
	if err != nil {
		t.Fatalf("seed account: %v", err)
	}
	return id
}

// SeedTestScan inserts a test scan with "processing" status and returns its ID.
func SeedTestScan(t *testing.T, pool *pgxpool.Pool, orgID, accountID string) string {
	t.Helper()
	var id string
	err := pool.QueryRow(context.Background(),
		`INSERT INTO scans (org_id, aws_account_id, status, started_at)
		 VALUES ($1, $2, 'processing', NOW())
		 RETURNING id`,
		orgID, accountID,
	).Scan(&id)
	if err != nil {
		t.Fatalf("seed scan: %v", err)
	}
	return id
}

// SeedTestJob inserts a test job linked to a scan and returns its ID.
func SeedTestJob(t *testing.T, pool *pgxpool.Pool, scanID, jobType string) string {
	t.Helper()
	var id string
	err := pool.QueryRow(context.Background(),
		`INSERT INTO jobs (scan_id, type, payload, status)
		 VALUES ($1, $2, '{}'::jsonb, 'queued')
		 RETURNING id`,
		scanID, jobType,
	).Scan(&id)
	if err != nil {
		t.Fatalf("seed job: %v", err)
	}
	return id
}

// startPostgresContainer starts a PostgreSQL testcontainer.
func startPostgresContainer(t *testing.T, ctx context.Context) string {
	t.Helper()

	container, err := tcpostgres.Run(ctx, "postgres:17-alpine",
		tcpostgres.WithDatabase("scanorbit_test"),
		tcpostgres.WithUsername("test"),
		tcpostgres.WithPassword("test"),
		testcontainers.WithWaitStrategy(
			wait.ForLog("database system is ready to accept connections").
				WithOccurrence(2).
				WithStartupTimeout(30*time.Second),
		),
	)
	if err != nil {
		t.Fatalf("start postgres container: %v", err)
	}

	t.Cleanup(func() {
		if err := container.Terminate(ctx); err != nil {
			t.Logf("terminate postgres container: %v", err)
		}
	})

	connStr, err := container.ConnectionString(ctx, "sslmode=disable")
	if err != nil {
		t.Fatalf("get connection string: %v", err)
	}
	return connStr
}

// startRedisContainer starts a Redis testcontainer.
func startRedisContainer(t *testing.T, ctx context.Context) string {
	t.Helper()

	container, err := tcredis.Run(ctx, "redis:7-alpine",
		testcontainers.WithWaitStrategy(
			wait.ForLog("Ready to accept connections").
				WithStartupTimeout(15*time.Second),
		),
	)
	if err != nil {
		t.Fatalf("start redis container: %v", err)
	}

	t.Cleanup(func() {
		if err := container.Terminate(ctx); err != nil {
			t.Logf("terminate redis container: %v", err)
		}
	})

	connStr, err := container.ConnectionString(ctx)
	if err != nil {
		t.Fatalf("get redis connection string: %v", err)
	}
	return connStr
}

// applyMigrations reads and executes SQL migration files.
func applyMigrations(t *testing.T, ctx context.Context, pool *pgxpool.Pool) {
	t.Helper()

	migrationsDir := os.Getenv("MIGRATIONS_DIR")
	if migrationsDir == "" {
		// Resolve relative to this file's location
		_, filename, _, _ := runtime.Caller(0)
		migrationsDir = filepath.Join(filepath.Dir(filename), "..", "..", "..", "apps", "api", "src", "db", "migrations")
	}

	files := []string{"0000_init.sql", "0001_bored_reavers.sql", "0002_clear_gamora.sql"}

	for _, f := range files {
		path := filepath.Join(migrationsDir, f)
		data, err := os.ReadFile(path)
		if err != nil {
			t.Fatalf("read migration %s: %v", f, err)
		}

		statements := splitMigrationStatements(string(data))
		for i, stmt := range statements {
			stmt = strings.TrimSpace(stmt)
			if stmt == "" {
				continue
			}
			if _, err := pool.Exec(ctx, stmt); err != nil {
				t.Fatalf("execute migration %s statement %d: %v\nSQL: %s", f, i, err, truncate(stmt, 200))
			}
		}
	}
}

// splitMigrationStatements splits Drizzle migration SQL on the breakpoint marker.
func splitMigrationStatements(sql string) []string {
	return strings.Split(sql, "--> statement-breakpoint")
}

// ApplyMigrationsFromPool applies migrations using a raw pool (for TestMain contexts without *testing.T).
// Panics on error.
func ApplyMigrationsFromPool(pool *pgxpool.Pool) {
	ctx := context.Background()

	migrationsDir := os.Getenv("MIGRATIONS_DIR")
	if migrationsDir == "" {
		_, filename, _, _ := runtime.Caller(0)
		migrationsDir = filepath.Join(filepath.Dir(filename), "..", "..", "..", "apps", "api", "src", "db", "migrations")
	}

	files := []string{"0000_init.sql", "0001_bored_reavers.sql", "0002_clear_gamora.sql"}

	for _, f := range files {
		path := filepath.Join(migrationsDir, f)
		data, err := os.ReadFile(path)
		if err != nil {
			panic(fmt.Sprintf("read migration %s: %v", f, err))
		}

		statements := splitMigrationStatements(string(data))
		for i, stmt := range statements {
			stmt = strings.TrimSpace(stmt)
			if stmt == "" {
				continue
			}
			if _, err := pool.Exec(ctx, stmt); err != nil {
				panic(fmt.Sprintf("execute migration %s statement %d: %v", f, i, err))
			}
		}
	}
}

func truncate(s string, maxLen int) string {
	if len(s) <= maxLen {
		return s
	}
	return s[:maxLen] + fmt.Sprintf("... (%d chars total)", len(s))
}
