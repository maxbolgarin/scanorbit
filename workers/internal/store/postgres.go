package store

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/maxbolgarin/scanorbit/internal/metrics"
)

// DB represents a PostgreSQL database connection pool.
type DB struct {
	pool *pgxpool.Pool
}

// NewDB creates a new database connection pool.
func NewDB(ctx context.Context, databaseURL string) (*DB, error) {
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

	pool, err := pgxpool.NewWithConfig(ctx, config)
	if err != nil {
		return nil, fmt.Errorf("create connection pool: %w", err)
	}

	// Verify connection
	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("ping database: %w", err)
	}

	db := &DB{pool: pool}

	// Start background goroutine to track connection pool stats
	go db.trackConnectionStats()

	return db, nil
}

// Pool returns the underlying connection pool.
func (db *DB) Pool() *pgxpool.Pool {
	return db.pool
}

// Close closes the database connection pool.
func (db *DB) Close() {
	db.pool.Close()
}

// Ping verifies the database connection is alive.
func (db *DB) Ping(ctx context.Context) error {
	return db.pool.Ping(ctx)
}

// trackConnectionStats periodically updates connection pool metrics.
func (db *DB) trackConnectionStats() {
	ticker := time.NewTicker(15 * time.Second)
	defer ticker.Stop()

	for range ticker.C {
		stats := db.pool.Stat()
		metrics.DBConnectionsOpen.WithLabelValues("total").Set(float64(stats.TotalConns()))
		metrics.DBConnectionsOpen.WithLabelValues("idle").Set(float64(stats.IdleConns()))
		metrics.DBConnectionsOpen.WithLabelValues("in_use").Set(float64(stats.AcquiredConns()))
	}
}
