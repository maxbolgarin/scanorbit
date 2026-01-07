package store

import (
	"context"
	"fmt"
	"time"
)

type scanStore struct {
	db *DB
}

func newScanStore(db *DB) *scanStore {
	return &scanStore{db: db}
}

// Create creates a new scan record.
func (s *scanStore) Create(ctx context.Context, scan *Scan) error {
	query := `
		INSERT INTO scans (id, org_id, aws_account_id, status, started_at, created_at)
		VALUES ($1, $2, $3, $4, $5, NOW())
	`

	_, err := s.db.Pool().Exec(ctx, query,
		scan.ID,
		scan.OrgID,
		scan.AWSAccountID,
		scan.Status,
		scan.StartedAt,
	)
	if err != nil {
		return fmt.Errorf("insert scan: %w", err)
	}

	return nil
}

// UpdateStatus updates the status of a scan.
func (s *scanStore) UpdateStatus(ctx context.Context, id string, status string, resourceCount int, errorMsg string) error {
	var completedAt *time.Time
	if status == "complete" || status == "error" || status == "partial" {
		now := time.Now()
		completedAt = &now
	}

	query := `
		UPDATE scans
		SET status = $2, resources_discovered = $3, error_message = $4, completed_at = $5
		WHERE id = $1
	`

	_, err := s.db.Pool().Exec(ctx, query, id, status, resourceCount, errorMsg, completedAt)
	if err != nil {
		return fmt.Errorf("update scan status: %w", err)
	}

	return nil
}

// GetByID retrieves a scan by ID.
func (s *scanStore) GetByID(ctx context.Context, id string) (*Scan, error) {
	query := `
		SELECT id, org_id, aws_account_id, status, started_at, completed_at,
		       resources_discovered, error_message, created_at
		FROM scans
		WHERE id = $1
	`

	var scan Scan
	err := s.db.Pool().QueryRow(ctx, query, id).Scan(
		&scan.ID,
		&scan.OrgID,
		&scan.AWSAccountID,
		&scan.Status,
		&scan.StartedAt,
		&scan.CompletedAt,
		&scan.ResourcesDiscovered,
		&scan.ErrorMessage,
		&scan.CreatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("query scan: %w", err)
	}

	return &scan, nil
}
