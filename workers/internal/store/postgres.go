package store

import (
	"context"
	"crypto/tls"
	"crypto/x509"
	"fmt"
	"os"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/maxbolgarin/scanorbit/internal/metrics"
)

// Tx represents a database transaction.
type Tx = pgx.Tx

// TxOptions are options for starting a transaction.
type TxOptions = pgx.TxOptions

// DB represents a PostgreSQL database connection pool.
type DB struct {
	pool      *pgxpool.Pool
	stopCh    chan struct{} // Channel to signal stats goroutine to stop
	stoppedCh chan struct{} // Channel to signal stats goroutine has stopped
}

// NewDB creates a new database connection pool.
// If sslmode=require is in the URL, CA certificate is required for secure TLS verification.
func NewDB(ctx context.Context, databaseURL, caCertPath string) (*DB, error) {
	config, err := pgxpool.ParseConfig(databaseURL)
	if err != nil {
		return nil, fmt.Errorf("parse database URL: %w", err)
	}

	// Configure pool settings
	config.MaxConns = 25
	config.MinConns = 5
	config.MaxConnLifetime = time.Hour
	config.MaxConnIdleTime = 30 * time.Minute
	config.HealthCheckPeriod = time.Minute

	// Configure TLS for SSL connections - require CA certificate for security
	if strings.Contains(databaseURL, "sslmode=require") || strings.Contains(databaseURL, "sslmode=verify-full") {
		if caCertPath == "" {
			return nil, fmt.Errorf("CA certificate path is required for TLS connections (sslmode=require)")
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
		config.ConnConfig.TLSConfig = tlsConfig
	}

	pool, err := pgxpool.NewWithConfig(ctx, config)
	if err != nil {
		return nil, fmt.Errorf("create connection pool: %w", err)
	}

	// Verify connection
	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("ping database: %w", err)
	}

	db := &DB{
		pool:      pool,
		stopCh:    make(chan struct{}),
		stoppedCh: make(chan struct{}),
	}

	// Start background goroutine to track connection pool stats
	go db.trackConnectionStats()

	return db, nil
}

// Pool returns the underlying connection pool.
func (db *DB) Pool() *pgxpool.Pool {
	return db.pool
}

// Close closes the database connection pool and stops background goroutines.
func (db *DB) Close() {
	// Signal stats goroutine to stop
	close(db.stopCh)

	// Wait for stats goroutine to stop (with timeout)
	select {
	case <-db.stoppedCh:
		// Stats goroutine stopped cleanly
	case <-time.After(5 * time.Second):
		// Continue anyway if it doesn't stop in time
	}

	db.pool.Close()
}

// Ping verifies the database connection is alive.
func (db *DB) Ping(ctx context.Context) error {
	return db.pool.Ping(ctx)
}

// BeginTx starts a new transaction with the given options.
func (db *DB) BeginTx(ctx context.Context, opts pgx.TxOptions) (pgx.Tx, error) {
	return db.pool.BeginTx(ctx, opts)
}

// WithTx executes a function within a transaction.
// If the function returns an error, the transaction is rolled back.
// If the function succeeds, the transaction is committed.
func (db *DB) WithTx(ctx context.Context, fn func(tx pgx.Tx) error) error {
	tx, err := db.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin transaction: %w", err)
	}

	defer func() {
		if p := recover(); p != nil {
			_ = tx.Rollback(ctx)
			panic(p)
		}
	}()

	if err := fn(tx); err != nil {
		if rbErr := tx.Rollback(ctx); rbErr != nil {
			return fmt.Errorf("rollback failed: %v (original error: %w)", rbErr, err)
		}
		return err
	}

	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("commit transaction: %w", err)
	}

	return nil
}

// trackConnectionStats periodically updates connection pool metrics.
// Gracefully stops when stopCh is closed.
func (db *DB) trackConnectionStats() {
	defer close(db.stoppedCh)

	ticker := time.NewTicker(15 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-db.stopCh:
			return
		case <-ticker.C:
			stats := db.pool.Stat()
			metrics.DBConnectionsOpen.WithLabelValues("total").Set(float64(stats.TotalConns()))
			metrics.DBConnectionsOpen.WithLabelValues("idle").Set(float64(stats.IdleConns()))
			metrics.DBConnectionsOpen.WithLabelValues("in_use").Set(float64(stats.AcquiredConns()))
		}
	}
}
