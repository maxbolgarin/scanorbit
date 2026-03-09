package testutil

import (
	"context"
	"time"

	"github.com/maxbolgarin/scanorbit/internal/models"
	"github.com/maxbolgarin/scanorbit/internal/store"
)

// Mocks holds all mock store implementations for easy access in tests.
type Mocks struct {
	Accounts      *MockAccountStore
	Scans         *MockScanStore
	Resources     *MockResourceStore
	ResourceScans *MockResourceScanStore
	Certificates  *MockCertificateStore
	Findings      *MockFindingStore
	FindingScans  *MockFindingScanStore
	Dependencies  *MockDependencyStore
	Jobs          *MockJobStore
	DeadLetters   *MockDeadLetterStore
	JobRecovery   *MockJobRecoveryStore
}

// NewMockStore returns a *store.Store populated with mock implementations.
func NewMockStore() (*store.Store, *Mocks) {
	mocks := &Mocks{
		Accounts:      &MockAccountStore{},
		Scans:         &MockScanStore{},
		Resources:     &MockResourceStore{},
		ResourceScans: &MockResourceScanStore{},
		Certificates:  &MockCertificateStore{},
		Findings:      &MockFindingStore{},
		FindingScans:  &MockFindingScanStore{},
		Dependencies:  &MockDependencyStore{},
		Jobs:          &MockJobStore{},
		DeadLetters:   &MockDeadLetterStore{},
		JobRecovery:   &MockJobRecoveryStore{},
	}
	st := &store.Store{
		Accounts:      mocks.Accounts,
		Scans:         mocks.Scans,
		Resources:     mocks.Resources,
		ResourceScans: mocks.ResourceScans,
		Certificates:  mocks.Certificates,
		Findings:      mocks.Findings,
		FindingScans:  mocks.FindingScans,
		Dependencies:  mocks.Dependencies,
		Jobs:          mocks.Jobs,
		DeadLetters:   mocks.DeadLetters,
		JobRecovery:   mocks.JobRecovery,
	}
	return st, mocks
}

// --- AccountStore ---

type MockAccountStore struct {
	GetByIDFn        func(ctx context.Context, id string) (*store.AWSAccount, error)
	ExistsFn         func(ctx context.Context, id string) (bool, error)
	UpdateLastScanAtFn func(ctx context.Context, id string, scannedAt time.Time) error
	UpdateStatusFn   func(ctx context.Context, id string, status string, lastError string) error
}

func (m *MockAccountStore) GetByID(ctx context.Context, id string) (*store.AWSAccount, error) {
	if m.GetByIDFn != nil {
		return m.GetByIDFn(ctx, id)
	}
	return nil, nil
}

func (m *MockAccountStore) Exists(ctx context.Context, id string) (bool, error) {
	if m.ExistsFn != nil {
		return m.ExistsFn(ctx, id)
	}
	return true, nil
}

func (m *MockAccountStore) UpdateLastScanAt(ctx context.Context, id string, scannedAt time.Time) error {
	if m.UpdateLastScanAtFn != nil {
		return m.UpdateLastScanAtFn(ctx, id, scannedAt)
	}
	return nil
}

func (m *MockAccountStore) UpdateStatus(ctx context.Context, id string, status string, lastError string) error {
	if m.UpdateStatusFn != nil {
		return m.UpdateStatusFn(ctx, id, status, lastError)
	}
	return nil
}

// --- ScanStore ---

type MockScanStore struct {
	CreateFn              func(ctx context.Context, scan *store.Scan) error
	UpdateStatusFn        func(ctx context.Context, id string, status string, resourceCount int, errorMsg string) error
	UpdateStatusOnlyFn    func(ctx context.Context, id string, status string) error
	UpdateStatusWithStartFn func(ctx context.Context, id string, status string) error
	GetByIDFn             func(ctx context.Context, id string) (*store.Scan, error)
}

func (m *MockScanStore) Create(ctx context.Context, scan *store.Scan) error {
	if m.CreateFn != nil {
		return m.CreateFn(ctx, scan)
	}
	return nil
}

func (m *MockScanStore) UpdateStatus(ctx context.Context, id string, status string, resourceCount int, errorMsg string) error {
	if m.UpdateStatusFn != nil {
		return m.UpdateStatusFn(ctx, id, status, resourceCount, errorMsg)
	}
	return nil
}

func (m *MockScanStore) UpdateStatusOnly(ctx context.Context, id string, status string) error {
	if m.UpdateStatusOnlyFn != nil {
		return m.UpdateStatusOnlyFn(ctx, id, status)
	}
	return nil
}

func (m *MockScanStore) UpdateStatusWithStart(ctx context.Context, id string, status string) error {
	if m.UpdateStatusWithStartFn != nil {
		return m.UpdateStatusWithStartFn(ctx, id, status)
	}
	return nil
}

func (m *MockScanStore) GetByID(ctx context.Context, id string) (*store.Scan, error) {
	if m.GetByIDFn != nil {
		return m.GetByIDFn(ctx, id)
	}
	return nil, nil
}

// --- ResourceStore ---

type MockResourceStore struct {
	UpsertFn           func(ctx context.Context, resource *models.Resource) error
	UpsertWithStatusFn func(ctx context.Context, resource *models.Resource) (string, bool, error)
	GetByAccountIDFn   func(ctx context.Context, accountID string) ([]*models.Resource, error)
	GetByServiceFn     func(ctx context.Context, accountID string, service models.ServiceType) ([]*models.Resource, error)
}

func (m *MockResourceStore) Upsert(ctx context.Context, resource *models.Resource) error {
	if m.UpsertFn != nil {
		return m.UpsertFn(ctx, resource)
	}
	return nil
}

func (m *MockResourceStore) UpsertWithStatus(ctx context.Context, resource *models.Resource) (string, bool, error) {
	if m.UpsertWithStatusFn != nil {
		return m.UpsertWithStatusFn(ctx, resource)
	}
	return resource.ID, false, nil
}

func (m *MockResourceStore) GetByAccountID(ctx context.Context, accountID string) ([]*models.Resource, error) {
	if m.GetByAccountIDFn != nil {
		return m.GetByAccountIDFn(ctx, accountID)
	}
	return nil, nil
}

func (m *MockResourceStore) GetByService(ctx context.Context, accountID string, service models.ServiceType) ([]*models.Resource, error) {
	if m.GetByServiceFn != nil {
		return m.GetByServiceFn(ctx, accountID, service)
	}
	return nil, nil
}

// --- CertificateStore ---

type MockCertificateStore struct {
	UpsertFn         func(ctx context.Context, cert *models.Certificate) error
	GetByAccountIDFn func(ctx context.Context, accountID string) ([]*models.Certificate, error)
}

func (m *MockCertificateStore) Upsert(ctx context.Context, cert *models.Certificate) error {
	if m.UpsertFn != nil {
		return m.UpsertFn(ctx, cert)
	}
	return nil
}

func (m *MockCertificateStore) GetByAccountID(ctx context.Context, accountID string) ([]*models.Certificate, error) {
	if m.GetByAccountIDFn != nil {
		return m.GetByAccountIDFn(ctx, accountID)
	}
	return nil, nil
}

// --- FindingStore ---

type MockFindingStore struct {
	UpsertFn                    func(ctx context.Context, finding *models.Finding) error
	UpsertWithHistoryFn         func(ctx context.Context, finding *models.Finding, scanID string) (string, bool, error)
	GetByAccountIDFn            func(ctx context.Context, accountID string) ([]*models.Finding, error)
	AutoResolveMissingFindingsFn func(ctx context.Context, scanID, accountID string, detectedFindingIDs []string) (int64, error)
	AutoResolveByScanIDFn       func(ctx context.Context, scanID, accountID string) (int64, error)
}

func (m *MockFindingStore) Upsert(ctx context.Context, finding *models.Finding) error {
	if m.UpsertFn != nil {
		return m.UpsertFn(ctx, finding)
	}
	return nil
}

func (m *MockFindingStore) UpsertWithHistory(ctx context.Context, finding *models.Finding, scanID string) (string, bool, error) {
	if m.UpsertWithHistoryFn != nil {
		return m.UpsertWithHistoryFn(ctx, finding, scanID)
	}
	return "finding-id", true, nil
}

func (m *MockFindingStore) GetByAccountID(ctx context.Context, accountID string) ([]*models.Finding, error) {
	if m.GetByAccountIDFn != nil {
		return m.GetByAccountIDFn(ctx, accountID)
	}
	return nil, nil
}

func (m *MockFindingStore) AutoResolveMissingFindings(ctx context.Context, scanID, accountID string, detectedFindingIDs []string) (int64, error) {
	if m.AutoResolveMissingFindingsFn != nil {
		return m.AutoResolveMissingFindingsFn(ctx, scanID, accountID, detectedFindingIDs)
	}
	return 0, nil
}

func (m *MockFindingStore) AutoResolveByScanID(ctx context.Context, scanID, accountID string) (int64, error) {
	if m.AutoResolveByScanIDFn != nil {
		return m.AutoResolveByScanIDFn(ctx, scanID, accountID)
	}
	return 0, nil
}

// --- FindingScanStore ---

type MockFindingScanStore struct {
	BulkUpsertFn      func(ctx context.Context, records []*models.FindingScan) error
	MarkNotDetectedFn func(ctx context.Context, scanID, accountID string, detectedFindingIDs []string) error
	GetByScanIDFn     func(ctx context.Context, scanID string) ([]*models.FindingScan, error)
	GetByFindingIDFn  func(ctx context.Context, findingID string) ([]*models.FindingScan, error)
}

func (m *MockFindingScanStore) BulkUpsert(ctx context.Context, records []*models.FindingScan) error {
	if m.BulkUpsertFn != nil {
		return m.BulkUpsertFn(ctx, records)
	}
	return nil
}

func (m *MockFindingScanStore) MarkNotDetected(ctx context.Context, scanID, accountID string, detectedFindingIDs []string) error {
	if m.MarkNotDetectedFn != nil {
		return m.MarkNotDetectedFn(ctx, scanID, accountID, detectedFindingIDs)
	}
	return nil
}

func (m *MockFindingScanStore) GetByScanID(ctx context.Context, scanID string) ([]*models.FindingScan, error) {
	if m.GetByScanIDFn != nil {
		return m.GetByScanIDFn(ctx, scanID)
	}
	return nil, nil
}

func (m *MockFindingScanStore) GetByFindingID(ctx context.Context, findingID string) ([]*models.FindingScan, error) {
	if m.GetByFindingIDFn != nil {
		return m.GetByFindingIDFn(ctx, findingID)
	}
	return nil, nil
}

// --- DependencyStore ---

type MockDependencyStore struct {
	UpsertFn                  func(ctx context.Context, dep *models.ResourceDependency) error
	BulkUpsertFn              func(ctx context.Context, deps []*models.ResourceDependency) error
	DeleteBySourceResourceIDFn func(ctx context.Context, sourceResourceID string) error
	DeleteByAccountIDFn       func(ctx context.Context, accountID string) error
	GetBySourceResourceIDFn   func(ctx context.Context, sourceResourceID string) ([]*models.ResourceDependency, error)
	GetByTargetFn             func(ctx context.Context, targetResourceID string) ([]*models.ResourceDependency, error)
}

func (m *MockDependencyStore) Upsert(ctx context.Context, dep *models.ResourceDependency) error {
	if m.UpsertFn != nil {
		return m.UpsertFn(ctx, dep)
	}
	return nil
}

func (m *MockDependencyStore) BulkUpsert(ctx context.Context, deps []*models.ResourceDependency) error {
	if m.BulkUpsertFn != nil {
		return m.BulkUpsertFn(ctx, deps)
	}
	return nil
}

func (m *MockDependencyStore) DeleteBySourceResourceID(ctx context.Context, sourceResourceID string) error {
	if m.DeleteBySourceResourceIDFn != nil {
		return m.DeleteBySourceResourceIDFn(ctx, sourceResourceID)
	}
	return nil
}

func (m *MockDependencyStore) DeleteByAccountID(ctx context.Context, accountID string) error {
	if m.DeleteByAccountIDFn != nil {
		return m.DeleteByAccountIDFn(ctx, accountID)
	}
	return nil
}

func (m *MockDependencyStore) GetBySourceResourceID(ctx context.Context, sourceResourceID string) ([]*models.ResourceDependency, error) {
	if m.GetBySourceResourceIDFn != nil {
		return m.GetBySourceResourceIDFn(ctx, sourceResourceID)
	}
	return nil, nil
}

func (m *MockDependencyStore) GetByTarget(ctx context.Context, targetResourceID string) ([]*models.ResourceDependency, error) {
	if m.GetByTargetFn != nil {
		return m.GetByTargetFn(ctx, targetResourceID)
	}
	return nil, nil
}

// --- ResourceScanStore ---

type MockResourceScanStore struct {
	BulkUpsertFn            func(ctx context.Context, records []*models.ResourceScan) error
	MarkRemovedResourcesFn  func(ctx context.Context, scanID, accountID string, foundResourceIDs []string) error
	DeleteStaleResourcesFn  func(ctx context.Context, accountID string, minScansRemoved int) (int64, error)
	GetByScanIDFn           func(ctx context.Context, scanID string) ([]*models.ResourceScan, error)
	GetByResourceIDFn       func(ctx context.Context, resourceID string) ([]*models.ResourceScan, error)
}

func (m *MockResourceScanStore) BulkUpsert(ctx context.Context, records []*models.ResourceScan) error {
	if m.BulkUpsertFn != nil {
		return m.BulkUpsertFn(ctx, records)
	}
	return nil
}

func (m *MockResourceScanStore) MarkRemovedResources(ctx context.Context, scanID, accountID string, foundResourceIDs []string) error {
	if m.MarkRemovedResourcesFn != nil {
		return m.MarkRemovedResourcesFn(ctx, scanID, accountID, foundResourceIDs)
	}
	return nil
}

func (m *MockResourceScanStore) DeleteStaleResources(ctx context.Context, accountID string, minScansRemoved int) (int64, error) {
	if m.DeleteStaleResourcesFn != nil {
		return m.DeleteStaleResourcesFn(ctx, accountID, minScansRemoved)
	}
	return 0, nil
}

func (m *MockResourceScanStore) GetByScanID(ctx context.Context, scanID string) ([]*models.ResourceScan, error) {
	if m.GetByScanIDFn != nil {
		return m.GetByScanIDFn(ctx, scanID)
	}
	return nil, nil
}

func (m *MockResourceScanStore) GetByResourceID(ctx context.Context, resourceID string) ([]*models.ResourceScan, error) {
	if m.GetByResourceIDFn != nil {
		return m.GetByResourceIDFn(ctx, resourceID)
	}
	return nil, nil
}

// --- JobStore ---

type MockJobStore struct {
	CreateFn                            func(ctx context.Context, job *store.Job) (string, error)
	UpdateStatusFn                      func(ctx context.Context, id string, status models.JobStatus, errorMsg string) error
	MarkRunningFn                       func(ctx context.Context, id string) error
	MarkCompleteFn                      func(ctx context.Context, id string) error
	MarkErrorFn                         func(ctx context.Context, id, errorMsg string) error
	CountIncompleteAnalyzerJobsForScanFn func(ctx context.Context, scanID string) (int, error)
}

func (m *MockJobStore) Create(ctx context.Context, job *store.Job) (string, error) {
	if m.CreateFn != nil {
		return m.CreateFn(ctx, job)
	}
	return "job-id", nil
}

func (m *MockJobStore) UpdateStatus(ctx context.Context, id string, status models.JobStatus, errorMsg string) error {
	if m.UpdateStatusFn != nil {
		return m.UpdateStatusFn(ctx, id, status, errorMsg)
	}
	return nil
}

func (m *MockJobStore) MarkRunning(ctx context.Context, id string) error {
	if m.MarkRunningFn != nil {
		return m.MarkRunningFn(ctx, id)
	}
	return nil
}

func (m *MockJobStore) MarkComplete(ctx context.Context, id string) error {
	if m.MarkCompleteFn != nil {
		return m.MarkCompleteFn(ctx, id)
	}
	return nil
}

func (m *MockJobStore) MarkError(ctx context.Context, id, errorMsg string) error {
	if m.MarkErrorFn != nil {
		return m.MarkErrorFn(ctx, id, errorMsg)
	}
	return nil
}

func (m *MockJobStore) CountIncompleteAnalyzerJobsForScan(ctx context.Context, scanID string) (int, error) {
	if m.CountIncompleteAnalyzerJobsForScanFn != nil {
		return m.CountIncompleteAnalyzerJobsForScanFn(ctx, scanID)
	}
	return 0, nil
}

// --- DeadLetterStore ---

type MockDeadLetterStore struct {
	CreateFn func(ctx context.Context, job *store.DeadLetterJob) error
}

func (m *MockDeadLetterStore) Create(ctx context.Context, job *store.DeadLetterJob) error {
	if m.CreateFn != nil {
		return m.CreateFn(ctx, job)
	}
	return nil
}

// --- JobRecoveryStore ---

type MockJobRecoveryStore struct {
	FindOrphanedJobsFn     func(ctx context.Context, olderThan time.Duration, limit int) ([]store.OrphanedJob, error)
	FindStuckRunningJobsFn func(ctx context.Context, olderThan time.Duration, limit int) ([]store.OrphanedJob, error)
	MarkJobRecoveredFn     func(ctx context.Context, jobID string) error
	ResetJobToQueuedFn     func(ctx context.Context, jobID string) error
	MarkJobExhaustedFn     func(ctx context.Context, jobID string) error
}

func (m *MockJobRecoveryStore) FindOrphanedJobs(ctx context.Context, olderThan time.Duration, limit int) ([]store.OrphanedJob, error) {
	if m.FindOrphanedJobsFn != nil {
		return m.FindOrphanedJobsFn(ctx, olderThan, limit)
	}
	return nil, nil
}

func (m *MockJobRecoveryStore) FindStuckRunningJobs(ctx context.Context, olderThan time.Duration, limit int) ([]store.OrphanedJob, error) {
	if m.FindStuckRunningJobsFn != nil {
		return m.FindStuckRunningJobsFn(ctx, olderThan, limit)
	}
	return nil, nil
}

func (m *MockJobRecoveryStore) MarkJobRecovered(ctx context.Context, jobID string) error {
	if m.MarkJobRecoveredFn != nil {
		return m.MarkJobRecoveredFn(ctx, jobID)
	}
	return nil
}

func (m *MockJobRecoveryStore) ResetJobToQueued(ctx context.Context, jobID string) error {
	if m.ResetJobToQueuedFn != nil {
		return m.ResetJobToQueuedFn(ctx, jobID)
	}
	return nil
}

func (m *MockJobRecoveryStore) MarkJobExhausted(ctx context.Context, jobID string) error {
	if m.MarkJobExhaustedFn != nil {
		return m.MarkJobExhaustedFn(ctx, jobID)
	}
	return nil
}
