package store

import (
	"context"
	"fmt"
	"time"
)

type accountStore struct {
	db *DB
}

func newAccountStore(db *DB) *accountStore {
	return &accountStore{db: db}
}

// GetByID retrieves an AWS account by ID.
func (s *accountStore) GetByID(ctx context.Context, id string) (*AWSAccount, error) {
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
		return nil, fmt.Errorf("query account: %w", err)
	}

	return &account, nil
}

// UpdateLastScanAt updates the last scan timestamp for an account.
func (s *accountStore) UpdateLastScanAt(ctx context.Context, id string, scannedAt time.Time) error {
	query := `
		UPDATE aws_accounts
		SET last_scan_at = $2, updated_at = NOW()
		WHERE id = $1
	`

	_, err := s.db.Pool().Exec(ctx, query, id, scannedAt)
	if err != nil {
		return fmt.Errorf("update last_scan_at: %w", err)
	}

	return nil
}

// UpdateStatus updates the status and error message for an account.
func (s *accountStore) UpdateStatus(ctx context.Context, id string, status string, lastError string) error {
	query := `
		UPDATE aws_accounts
		SET status = $2, last_error = $3, updated_at = NOW()
		WHERE id = $1
	`

	_, err := s.db.Pool().Exec(ctx, query, id, status, lastError)
	if err != nil {
		return fmt.Errorf("update status: %w", err)
	}

	return nil
}
