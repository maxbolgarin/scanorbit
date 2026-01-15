package store

import (
	"context"
	"fmt"
	"time"

	"github.com/maxbolgarin/scanorbit/internal/metrics"
)

type accountStore struct {
	db *DB
}

func newAccountStore(db *DB) *accountStore {
	return &accountStore{db: db}
}

// GetByID retrieves an AWS account by ID.
func (s *accountStore) GetByID(ctx context.Context, id string) (*AWSAccount, error) {
	finish := metrics.TrackDBQuery("select", "aws_accounts")

	query := `
		SELECT id, org_id, name, aws_account_id, role_arn, external_id,
		       status, last_error, last_scan_at, created_at, updated_at
		FROM aws_accounts
		WHERE id = $1
	`

	var account AWSAccount
	err := s.db.Pool().QueryRow(ctx, query, id).Scan(
		&account.ID,
		&account.OrgID,
		&account.Name,
		&account.AWSAccountID,
		&account.RoleARN,
		&account.ExternalID,
		&account.Status,
		&account.LastError,
		&account.LastScanAt,
		&account.CreatedAt,
		&account.UpdatedAt,
	)
	if err != nil {
		finish("error")
		return nil, fmt.Errorf("query account: %w", err)
	}

	finish("success")
	return &account, nil
}

// Exists checks if an AWS account exists by ID.
func (s *accountStore) Exists(ctx context.Context, id string) (bool, error) {
	finish := metrics.TrackDBQuery("select", "aws_accounts")

	query := `SELECT EXISTS(SELECT 1 FROM aws_accounts WHERE id = $1)`

	var exists bool
	err := s.db.Pool().QueryRow(ctx, query, id).Scan(&exists)
	if err != nil {
		finish("error")
		return false, fmt.Errorf("check account exists: %w", err)
	}

	finish("success")
	return exists, nil
}

// UpdateLastScanAt updates the last scan timestamp for an account.
func (s *accountStore) UpdateLastScanAt(ctx context.Context, id string, scannedAt time.Time) error {
	finish := metrics.TrackDBQuery("update", "aws_accounts")

	query := `
		UPDATE aws_accounts
		SET last_scan_at = $2, updated_at = NOW()
		WHERE id = $1
	`

	_, err := s.db.Pool().Exec(ctx, query, id, scannedAt)
	if err != nil {
		finish("error")
		return fmt.Errorf("update last_scan_at: %w", err)
	}

	finish("success")
	return nil
}

// UpdateStatus updates the status and error message for an account.
func (s *accountStore) UpdateStatus(ctx context.Context, id string, status string, lastError string) error {
	finish := metrics.TrackDBQuery("update", "aws_accounts")

	query := `
		UPDATE aws_accounts
		SET status = $2, last_error = $3, updated_at = NOW()
		WHERE id = $1
	`

	// Convert empty string to nil for NULL in database
	var errPtr *string
	if lastError != "" {
		errPtr = &lastError
	}

	_, err := s.db.Pool().Exec(ctx, query, id, status, errPtr)
	if err != nil {
		finish("error")
		return fmt.Errorf("update status: %w", err)
	}

	finish("success")
	return nil
}
