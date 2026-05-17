package scanner

import (
	"time"

	"github.com/maxbolgarin/scanorbit/internal/models"
)

// RegionResult holds the results from scanning a single region.
type RegionResult struct {
	Region        string
	Resources     []*models.Resource
	Certificates  []*models.Certificate
	Error         error    // Set if the entire region scan failed
	ScannerErrors []string // Errors from individual scanners (partial failures)
}

// ScanResult holds the aggregated results from scanning an account.
type ScanResult struct {
	AccountID         string
	OrgID             string
	TotalResources    int
	TotalCertificates int
	RegionResults     []*RegionResult
	Errors            []error
	StartedAt         time.Time
	CompletedAt       time.Time
}

// HasErrors returns true if any errors occurred during the scan.
func (r *ScanResult) HasErrors() bool {
	return len(r.Errors) > 0
}

// ErrorCount returns the number of errors.
func (r *ScanResult) ErrorCount() int {
	return len(r.Errors)
}

// Duration returns how long the scan took.
func (r *ScanResult) Duration() time.Duration {
	return r.CompletedAt.Sub(r.StartedAt)
}
