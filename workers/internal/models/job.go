package models

// JobType represents the type of background job.
type JobType string

const (
	JobTypeScanAccount      JobType = "scan_account"
	JobTypeAnalyzeOrphans   JobType = "analyze_orphans"
	JobTypeAnalyzeSSL       JobType = "analyze_ssl"
	JobTypeAnalyzeResidency JobType = "analyze_residency"
)

// ScanAccountJob is the payload for a scan_account job.
type ScanAccountJob struct {
	AccountID string `json:"account_id"`
	OrgID     string `json:"org_id"`
}

// AnalyzeJob is the payload for analyze jobs.
type AnalyzeJob struct {
	AccountID string           `json:"account_id"`
	OrgID     string           `json:"org_id"`
	Policy    *ResidencyPolicy `json:"policy,omitempty"`
}

// ResidencyPolicy defines allowed regions for data residency checks.
type ResidencyPolicy struct {
	AllowedRegions []string `json:"allowed_regions"`
}
