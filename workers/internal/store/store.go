package store

import (
	"context"
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
	AWSAccountID        string
	Status              string
	StartedAt           *time.Time
	CompletedAt         *time.Time
	ResourcesDiscovered int
	ErrorMessage        string
	CreatedAt           time.Time
}

// AccountStore defines operations for AWS accounts.
type AccountStore interface {
	GetByID(ctx context.Context, id string) (*AWSAccount, error)
	UpdateLastScanAt(ctx context.Context, id string, scannedAt time.Time) error
	UpdateStatus(ctx context.Context, id string, status string, lastError string) error
}

// ScanStore defines operations for scans.
type ScanStore interface {
	Create(ctx context.Context, scan *Scan) error
	UpdateStatus(ctx context.Context, id string, status string, resourceCount int, errorMsg string) error
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
	Accounts     AccountStore
	Scans        ScanStore
	Resources    ResourceStore
	Certificates CertificateStore
	Findings     FindingStore
	DeadLetters  DeadLetterStore
}

// NewStore creates a new Store with all repositories.
func NewStore(db *DB) *Store {
	return &Store{
		Accounts:     newAccountStore(db),
		Scans:        newScanStore(db),
		Resources:    newResourceStore(db),
		Certificates: newCertificateStore(db),
		Findings:     newFindingStore(db),
		DeadLetters:  newDeadLetterStore(db),
	}
}
