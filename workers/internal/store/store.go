package store

import (
	"context"
	"fmt"
	"time"

	"github.com/maxbolgarin/scanorbit/internal/models"
)

// AWSAccount represents an AWS account from the database.
type AWSAccount struct {
	ID           string
	OrgID        string
	Name         string
	AWSAccountID string // 12-digit AWS account ID
	RoleARN      string
	ExternalID   string
	Status       string
	LastError    *string
	LastScanAt   *time.Time
	CreatedAt    time.Time
	UpdatedAt    time.Time
}

// Scan represents a scan job from the database.
type Scan struct {
	ID                  string
	OrgID               string
	AWSAccountID        *string // Nullable when account is deleted
	Status              string
	HasKey              bool // false when associated AWS account is deleted
	StartedAt           *time.Time
	CompletedAt         *time.Time
	ResourcesDiscovered int
	ErrorMessage        string
	CreatedAt           time.Time
}

// Job represents a background job from the database.
type Job struct {
	ID          string
	Type        string
	ScanID      *string // Link to parent scan (for analyzer jobs)
	Payload     []byte
	Status      string
	Error       *string
	CreatedAt   time.Time
	StartedAt   *time.Time
	CompletedAt *time.Time
}

// AccountStore defines operations for AWS accounts.
type AccountStore interface {
	GetByID(ctx context.Context, id string) (*AWSAccount, error)
	Exists(ctx context.Context, id string) (bool, error)
	UpdateLastScanAt(ctx context.Context, id string, scannedAt time.Time) error
	UpdateStatus(ctx context.Context, id string, status string, lastError string) error
}

// ScanStore defines operations for scans.
type ScanStore interface {
	Create(ctx context.Context, scan *Scan) error
	UpdateStatus(ctx context.Context, id string, status string, resourceCount int, errorMsg string) error
	UpdateStatusOnly(ctx context.Context, id string, status string) error
	GetByID(ctx context.Context, id string) (*Scan, error)
}

// ResourceStore defines operations for resources.
type ResourceStore interface {
	Upsert(ctx context.Context, resource *models.Resource) error
	GetByAccountID(ctx context.Context, accountID string) ([]*models.Resource, error)
	GetByService(ctx context.Context, accountID string, service models.ServiceType) ([]*models.Resource, error)
}

// CertificateStore defines operations for certificates.
type CertificateStore interface {
	Upsert(ctx context.Context, cert *models.Certificate) error
	GetByAccountID(ctx context.Context, accountID string) ([]*models.Certificate, error)
}

// FindingStore defines operations for findings.
type FindingStore interface {
	Upsert(ctx context.Context, finding *models.Finding) error
	GetByAccountID(ctx context.Context, accountID string) ([]*models.Finding, error)
}

// Store aggregates all store interfaces.
type Store struct {
	db           *DB
	Accounts     AccountStore
	Scans        ScanStore
	Resources    ResourceStore
	Certificates CertificateStore
	Findings     FindingStore
	Jobs         JobStore
	DeadLetters  DeadLetterStore
	JobRecovery  JobRecoveryStore
}

// NewStore creates a new Store with all repositories.
func NewStore(db *DB) *Store {
	return &Store{
		db:           db,
		Accounts:     newAccountStore(db),
		Scans:        newScanStore(db),
		Resources:    newResourceStore(db),
		Certificates: newCertificateStore(db),
		Findings:     newFindingStore(db),
		Jobs:         newJobStore(db),
		DeadLetters:  newDeadLetterStore(db),
		JobRecovery:  newJobRecoveryStore(db),
	}
}

// CompleteScanWithAccount atomically updates scan status and account metadata.
func (s *Store) CompleteScanWithAccount(ctx context.Context, scanID, accountID, status string, resourceCount int, errMsg string, lastScanAt time.Time) error {
	return s.db.WithTx(ctx, func(tx Tx) error {
		// Update scan status
		var completedAt *time.Time
		if status == "complete" || status == "error" || status == "partial" || status == "canceled" {
			now := time.Now()
			completedAt = &now
		}

		scanQuery := `
			UPDATE scans
			SET status = $2, resources_discovered = $3, error_message = $4, completed_at = $5
			WHERE id = $1
		`
		if _, err := tx.Exec(ctx, scanQuery, scanID, status, resourceCount, errMsg, completedAt); err != nil {
			return fmt.Errorf("update scan: %w", err)
		}

		// Update account last_scan_at
		accountScanQuery := `
			UPDATE aws_accounts
			SET last_scan_at = $2, updated_at = NOW()
			WHERE id = $1
		`
		if _, err := tx.Exec(ctx, accountScanQuery, accountID, lastScanAt); err != nil {
			return fmt.Errorf("update account last_scan_at: %w", err)
		}

		// Update account status
		accountStatus := "ok"
		accountError := ""
		if status == "error" {
			accountStatus = "error"
			accountError = errMsg
		}

		accountStatusQuery := `
			UPDATE aws_accounts
			SET status = $2, last_error = $3, updated_at = NOW()
			WHERE id = $1
		`
		if _, err := tx.Exec(ctx, accountStatusQuery, accountID, accountStatus, accountError); err != nil {
			return fmt.Errorf("update account status: %w", err)
		}

		return nil
	})
}

// FailScanWithAccount atomically marks scan and account as error.
func (s *Store) FailScanWithAccount(ctx context.Context, scanID, accountID, errMsg string) error {
	return s.db.WithTx(ctx, func(tx Tx) error {
		// Update scan status to error
		scanQuery := `
			UPDATE scans
			SET status = 'error', error_message = $2, completed_at = NOW()
			WHERE id = $1
		`
		if _, err := tx.Exec(ctx, scanQuery, scanID, errMsg); err != nil {
			return fmt.Errorf("update scan to error: %w", err)
		}

		// Update account status to error
		accountQuery := `
			UPDATE aws_accounts
			SET status = 'error', last_error = $2, updated_at = NOW()
			WHERE id = $1
		`
		if _, err := tx.Exec(ctx, accountQuery, accountID, errMsg); err != nil {
			return fmt.Errorf("update account to error: %w", err)
		}

		return nil
	})
}

// FailJobWithScan atomically marks job and scan as error.
func (s *Store) FailJobWithScan(ctx context.Context, jobID, scanID, errMsg string) error {
	return s.db.WithTx(ctx, func(tx Tx) error {
		// Update job status to error
		if jobID != "" {
			jobQuery := `
				UPDATE jobs
				SET status = 'error', error = $2, completed_at = NOW()
				WHERE id = $1
			`
			if _, err := tx.Exec(ctx, jobQuery, jobID, errMsg); err != nil {
				return fmt.Errorf("update job to error: %w", err)
			}
		}

		// Update scan status to error
		if scanID != "" {
			scanQuery := `
				UPDATE scans
				SET status = 'error', error_message = $2, completed_at = NOW()
				WHERE id = $1
			`
			if _, err := tx.Exec(ctx, scanQuery, scanID, errMsg); err != nil {
				return fmt.Errorf("update scan to error: %w", err)
			}
		}

		return nil
	})
}

// CompleteAnalyzerJob atomically completes an analyzer job and checks if scan should be marked complete.
// Returns true if the scan was marked as complete.
func (s *Store) CompleteAnalyzerJob(ctx context.Context, jobID, scanID string) (bool, error) {
	scanCompleted := false

	err := s.db.WithTx(ctx, func(tx Tx) error {
		// Mark job as complete
		if jobID != "" {
			jobQuery := `
				UPDATE jobs
				SET status = 'complete', completed_at = NOW()
				WHERE id = $1
			`
			if _, err := tx.Exec(ctx, jobQuery, jobID); err != nil {
				return fmt.Errorf("mark job complete: %w", err)
			}
		}

		// Check if all analyzer jobs for this scan are done
		if scanID != "" {
			var remaining int
			countQuery := `
				SELECT COUNT(*)
				FROM jobs
				WHERE scan_id = $1
				AND type LIKE 'analyze_%'
				AND status NOT IN ('complete', 'error')
			`
			if err := tx.QueryRow(ctx, countQuery, scanID).Scan(&remaining); err != nil {
				return fmt.Errorf("count incomplete jobs: %w", err)
			}

			if remaining == 0 {
				scanQuery := `
					UPDATE scans
					SET status = 'complete', completed_at = NOW()
					WHERE id = $1
				`
				if _, err := tx.Exec(ctx, scanQuery, scanID); err != nil {
					return fmt.Errorf("update scan to complete: %w", err)
				}
				scanCompleted = true
			}
		}

		return nil
	})

	return scanCompleted, err
}

// FailAnalyzerJob atomically marks an analyzer job as error and checks if scan should be marked complete.
// Returns true if the scan was marked as complete.
func (s *Store) FailAnalyzerJob(ctx context.Context, jobID, scanID, errMsg string) (bool, error) {
	scanCompleted := false

	err := s.db.WithTx(ctx, func(tx Tx) error {
		// Mark job as error
		if jobID != "" {
			jobQuery := `
				UPDATE jobs
				SET status = 'error', error = $2, completed_at = NOW()
				WHERE id = $1
			`
			if _, err := tx.Exec(ctx, jobQuery, jobID, errMsg); err != nil {
				return fmt.Errorf("mark job error: %w", err)
			}
		}

		// Check if all analyzer jobs for this scan are done (including this errored one)
		if scanID != "" {
			var remaining int
			countQuery := `
				SELECT COUNT(*)
				FROM jobs
				WHERE scan_id = $1
				AND type LIKE 'analyze_%'
				AND status NOT IN ('complete', 'error')
			`
			if err := tx.QueryRow(ctx, countQuery, scanID).Scan(&remaining); err != nil {
				return fmt.Errorf("count incomplete jobs: %w", err)
			}

			if remaining == 0 {
				// Mark scan as complete (even with errors, all jobs are done)
				scanQuery := `
					UPDATE scans
					SET status = 'complete', completed_at = NOW()
					WHERE id = $1
				`
				if _, err := tx.Exec(ctx, scanQuery, scanID); err != nil {
					return fmt.Errorf("update scan to complete: %w", err)
				}
				scanCompleted = true
			}
		}

		return nil
	})

	return scanCompleted, err
}
