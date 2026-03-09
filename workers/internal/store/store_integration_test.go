//go:build integration

package store

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
)

var (
	testDB    *DB
	testPool  *pgxpool.Pool
	testStore *Store
)

func TestMain(m *testing.M) {
	metrics.Init(metrics.Config{
		ServiceName: "integration-test",
		Environment: "test",
		Version:     "0.0.0",
	})

	var cleanup func()
	testDB, testPool, cleanup = setupForTestMain()
	if testDB == nil {
		// No DATABASE_URL set — skip all integration tests
		os.Exit(0)
	}
	testStore = NewStore(testDB, nil)

	code := m.Run()
	cleanup()
	os.Exit(code)
}

func setupForTestMain() (*DB, *pgxpool.Pool, func()) {
	ctx := context.Background()

	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		return nil, nil, func() {}
	}

	db, err := NewDB(ctx, dbURL, "")
	if err != nil {
		panic("NewDB: " + err.Error())
	}

	pool := db.Pool()
	applyTestMigrations(pool)

	return db, pool, func() { db.Close() }
}

func skipIfNoDB(t *testing.T) {
	t.Helper()
	if testDB == nil {
		t.Skip("DATABASE_URL not set, skipping integration test")
	}
}

func truncateAll(t *testing.T) {
	t.Helper()
	skipIfNoDB(t)
	ctx := context.Background()
	_, err := testPool.Exec(ctx, `
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

func seedTestOrg(t *testing.T) string {
	t.Helper()
	var id string
	err := testPool.QueryRow(context.Background(),
		`INSERT INTO orgs (name, slug, tier) VALUES ('Test Org', 'test-org', 'free') RETURNING id`,
	).Scan(&id)
	if err != nil {
		t.Fatalf("seed org: %v", err)
	}
	return id
}

func seedTestAccount(t *testing.T, orgID string) string {
	t.Helper()
	var id string
	err := testPool.QueryRow(context.Background(),
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

func seedTestScan(t *testing.T, orgID, accountID string) string {
	t.Helper()
	var id string
	err := testPool.QueryRow(context.Background(),
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

func seedTestJob(t *testing.T, scanID, jobType string) string {
	t.Helper()
	var id string
	err := testPool.QueryRow(context.Background(),
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

func applyTestMigrations(pool *pgxpool.Pool) {
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

		statements := strings.Split(string(data), "--> statement-breakpoint")
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

// --- Aggregate Transaction Tests ---

func TestCompleteScanWithAccount(t *testing.T) {
	truncateAll(t)
	ctx := context.Background()

	orgID := seedTestOrg(t)
	accountID := seedTestAccount(t, orgID)

	// Create a previous completed scan with known resource count
	var prevScanID string
	err := testPool.QueryRow(ctx,
		`INSERT INTO scans (org_id, aws_account_id, status, resources_discovered, started_at, completed_at)
		 VALUES ($1, $2, 'complete', 10, NOW() - interval '1 hour', NOW() - interval '30 minutes')
		 RETURNING id`, orgID, accountID).Scan(&prevScanID)
	if err != nil {
		t.Fatal(err)
	}

	// Create current scan
	scanID := seedTestScan(t, orgID, accountID)
	now := time.Now()

	// Complete the scan
	err = testStore.CompleteScanWithAccount(ctx, scanID, accountID, "complete", 15, "", now)
	if err != nil {
		t.Fatalf("CompleteScanWithAccount: %v", err)
	}

	// Verify scan status
	var status string
	var resourcesDelta int
	var completedAt *time.Time
	err = testPool.QueryRow(ctx,
		`SELECT status, resources_delta, completed_at FROM scans WHERE id = $1`, scanID,
	).Scan(&status, &resourcesDelta, &completedAt)
	if err != nil {
		t.Fatal(err)
	}
	if status != "complete" {
		t.Errorf("scan status = %q, want complete", status)
	}
	if resourcesDelta != 5 { // 15 - 10
		t.Errorf("resources_delta = %d, want 5", resourcesDelta)
	}
	if completedAt == nil {
		t.Error("completed_at should be set")
	}

	// Verify account updated
	var accountStatus string
	var lastScanAt *time.Time
	err = testPool.QueryRow(ctx,
		`SELECT status, last_scan_at FROM aws_accounts WHERE id = $1`, accountID,
	).Scan(&accountStatus, &lastScanAt)
	if err != nil {
		t.Fatal(err)
	}
	if accountStatus != "ok" {
		t.Errorf("account status = %q, want ok", accountStatus)
	}
	if lastScanAt == nil {
		t.Error("last_scan_at should be set")
	}
}

func TestCompleteScanWithAccount_ErrorStatus(t *testing.T) {
	truncateAll(t)
	ctx := context.Background()

	orgID := seedTestOrg(t)
	accountID := seedTestAccount(t, orgID)
	scanID := seedTestScan(t, orgID, accountID)

	err := testStore.CompleteScanWithAccount(ctx, scanID, accountID, "error", 0, "some error", time.Now())
	if err != nil {
		t.Fatalf("CompleteScanWithAccount: %v", err)
	}

	var accountStatus, lastError string
	err = testPool.QueryRow(ctx,
		`SELECT status, COALESCE(last_error, '') FROM aws_accounts WHERE id = $1`, accountID,
	).Scan(&accountStatus, &lastError)
	if err != nil {
		t.Fatal(err)
	}
	if accountStatus != "error" {
		t.Errorf("account status = %q, want error", accountStatus)
	}
	if lastError == "" {
		t.Error("last_error should be set")
	}
}

func TestFailScanWithAccount(t *testing.T) {
	truncateAll(t)
	ctx := context.Background()

	orgID := seedTestOrg(t)
	accountID := seedTestAccount(t, orgID)
	scanID := seedTestScan(t, orgID, accountID)

	err := testStore.FailScanWithAccount(ctx, scanID, accountID, "something failed")
	if err != nil {
		t.Fatalf("FailScanWithAccount: %v", err)
	}

	// Verify both scan and account are error
	var scanStatus string
	err = testPool.QueryRow(ctx, `SELECT status FROM scans WHERE id = $1`, scanID).Scan(&scanStatus)
	if err != nil {
		t.Fatal(err)
	}
	if scanStatus != "error" {
		t.Errorf("scan status = %q, want error", scanStatus)
	}

	var accountStatus string
	err = testPool.QueryRow(ctx, `SELECT status FROM aws_accounts WHERE id = $1`, accountID).Scan(&accountStatus)
	if err != nil {
		t.Fatal(err)
	}
	if accountStatus != "error" {
		t.Errorf("account status = %q, want error", accountStatus)
	}
}

func TestFailJobWithScan(t *testing.T) {
	truncateAll(t)
	ctx := context.Background()

	orgID := seedTestOrg(t)
	accountID := seedTestAccount(t, orgID)
	scanID := seedTestScan(t, orgID, accountID)
	jobID := seedTestJob(t, scanID, "analyze_orphans")

	err := testStore.FailJobWithScan(ctx, jobID, scanID, "job failed")
	if err != nil {
		t.Fatalf("FailJobWithScan: %v", err)
	}

	var jobStatus string
	err = testPool.QueryRow(ctx, `SELECT status FROM jobs WHERE id = $1`, jobID).Scan(&jobStatus)
	if err != nil {
		t.Fatal(err)
	}
	if jobStatus != "error" {
		t.Errorf("job status = %q, want error", jobStatus)
	}

	var scanStatus string
	err = testPool.QueryRow(ctx, `SELECT status FROM scans WHERE id = $1`, scanID).Scan(&scanStatus)
	if err != nil {
		t.Fatal(err)
	}
	if scanStatus != "error" {
		t.Errorf("scan status = %q, want error", scanStatus)
	}
}

func TestFailJobWithScan_EmptyJobID(t *testing.T) {
	truncateAll(t)
	ctx := context.Background()

	orgID := seedTestOrg(t)
	accountID := seedTestAccount(t, orgID)
	scanID := seedTestScan(t, orgID, accountID)

	// Should still mark scan as error even with empty job ID
	err := testStore.FailJobWithScan(ctx, "", scanID, "job failed")
	if err != nil {
		t.Fatalf("FailJobWithScan with empty jobID: %v", err)
	}

	var scanStatus string
	err = testPool.QueryRow(ctx, `SELECT status FROM scans WHERE id = $1`, scanID).Scan(&scanStatus)
	if err != nil {
		t.Fatal(err)
	}
	if scanStatus != "error" {
		t.Errorf("scan status = %q, want error", scanStatus)
	}
}

func TestCompleteAnalyzerJob_AllComplete(t *testing.T) {
	truncateAll(t)
	ctx := context.Background()

	orgID := seedTestOrg(t)
	accountID := seedTestAccount(t, orgID)
	scanID := seedTestScan(t, orgID, accountID)

	job1 := seedTestJob(t, scanID, "analyze_orphans")
	job2 := seedTestJob(t, scanID, "analyze_security")
	job3 := seedTestJob(t, scanID, "analyze_cost")

	// Complete first two — scan should NOT be complete yet
	completed, err := testStore.CompleteAnalyzerJob(ctx, job1, scanID)
	if err != nil {
		t.Fatal(err)
	}
	if completed {
		t.Error("scan should not be complete after first job")
	}

	completed, err = testStore.CompleteAnalyzerJob(ctx, job2, scanID)
	if err != nil {
		t.Fatal(err)
	}
	if completed {
		t.Error("scan should not be complete after second job")
	}

	// Complete last job — scan should be marked complete
	completed, err = testStore.CompleteAnalyzerJob(ctx, job3, scanID)
	if err != nil {
		t.Fatal(err)
	}
	if !completed {
		t.Error("scan should be complete after all jobs done")
	}

	// Verify scan is complete
	var scanStatus string
	err = testPool.QueryRow(ctx, `SELECT status FROM scans WHERE id = $1`, scanID).Scan(&scanStatus)
	if err != nil {
		t.Fatal(err)
	}
	if scanStatus != "complete" {
		t.Errorf("scan status = %q, want complete", scanStatus)
	}
}

func TestFailAnalyzerJob_LastJobFails(t *testing.T) {
	truncateAll(t)
	ctx := context.Background()

	orgID := seedTestOrg(t)
	accountID := seedTestAccount(t, orgID)
	scanID := seedTestScan(t, orgID, accountID)

	job1 := seedTestJob(t, scanID, "analyze_orphans")
	job2 := seedTestJob(t, scanID, "analyze_security")

	// Complete first job
	_, err := testStore.CompleteAnalyzerJob(ctx, job1, scanID)
	if err != nil {
		t.Fatal(err)
	}

	// Fail the last job — scan should still complete (all jobs done)
	completed, err := testStore.FailAnalyzerJob(ctx, job2, scanID, "analysis error")
	if err != nil {
		t.Fatal(err)
	}
	if !completed {
		t.Error("scan should be complete after all jobs done (even with failures)")
	}

	var scanStatus string
	err = testPool.QueryRow(ctx, `SELECT status FROM scans WHERE id = $1`, scanID).Scan(&scanStatus)
	if err != nil {
		t.Fatal(err)
	}
	if scanStatus != "complete" {
		t.Errorf("scan status = %q, want complete", scanStatus)
	}
}

// --- CRUD Tests ---

func TestJobLifecycle(t *testing.T) {
	truncateAll(t)
	ctx := context.Background()

	orgID := seedTestOrg(t)
	accountID := seedTestAccount(t, orgID)
	scanID := seedTestScan(t, orgID, accountID)
	jobID := seedTestJob(t, scanID, "analyze_orphans")

	// Mark running
	err := testStore.Jobs.MarkRunning(ctx, jobID)
	if err != nil {
		t.Fatalf("MarkRunning: %v", err)
	}

	var status string
	var startedAt *time.Time
	err = testPool.QueryRow(ctx, `SELECT status, started_at FROM jobs WHERE id = $1`, jobID).Scan(&status, &startedAt)
	if err != nil {
		t.Fatal(err)
	}
	if status != "running" {
		t.Errorf("status = %q, want running", status)
	}
	if startedAt == nil {
		t.Error("started_at should be set")
	}

	// Mark complete
	err = testStore.Jobs.MarkComplete(ctx, jobID)
	if err != nil {
		t.Fatalf("MarkComplete: %v", err)
	}

	err = testPool.QueryRow(ctx, `SELECT status FROM jobs WHERE id = $1`, jobID).Scan(&status)
	if err != nil {
		t.Fatal(err)
	}
	if status != "complete" {
		t.Errorf("status = %q, want complete", status)
	}
}

func TestDeadLetterCreate(t *testing.T) {
	truncateAll(t)
	ctx := context.Background()

	err := testStore.DeadLetters.Create(ctx, &DeadLetterJob{
		JobType: "analyze_orphans",
		Payload: []byte(`{"test": true}`),
		Error:   "max retries exceeded",
		Retries: 3,
	})
	if err != nil {
		t.Fatalf("Create: %v", err)
	}

	var count int
	err = testPool.QueryRow(ctx, `SELECT COUNT(*) FROM dead_letter_jobs WHERE job_type = 'analyze_orphans'`).Scan(&count)
	if err != nil {
		t.Fatal(err)
	}
	if count != 1 {
		t.Errorf("count = %d, want 1", count)
	}
}
