package models

import "errors"

// JobType represents the type of background job.
type JobType string

const (
	JobTypeScanAccount      JobType = "scan_account"
	JobTypeAnalyzeOrphans   JobType = "analyze_orphans"
	JobTypeAnalyzeSSL       JobType = "analyze_ssl"
	JobTypeAnalyzeResidency JobType = "analyze_residency"
	JobTypeAnalyzeSecurity  JobType = "analyze_security"
	JobTypeAnalyzeCost      JobType = "analyze_cost"
	JobTypeAnalyzeTagging   JobType = "analyze_tagging"
	JobTypeAnalyzeIAM       JobType = "analyze_iam"
)

// ScanStatus represents the status of a scan.
type ScanStatus string

const (
	ScanStatusQueued          ScanStatus = "queued"
	ScanStatusProcessing      ScanStatus = "processing"
	ScanStatusRunning         ScanStatus = "running"
	ScanStatusAnalyzingPending ScanStatus = "analyzing_pending" // Scan done, analyzer jobs created
	ScanStatusAnalyzing       ScanStatus = "analyzing"
	ScanStatusComplete        ScanStatus = "complete"
	ScanStatusPartial         ScanStatus = "partial"
	ScanStatusError           ScanStatus = "error"
	ScanStatusCanceled        ScanStatus = "canceled"
)

// JobStatus represents the status of a background job.
type JobStatus string

const (
	JobStatusQueued   JobStatus = "queued"
	JobStatusRunning  JobStatus = "running"
	JobStatusComplete JobStatus = "complete"
	JobStatusError    JobStatus = "error"
)

// IsActive returns true if the scan status is an active (in-progress) status.
func (s ScanStatus) IsActive() bool {
	switch s {
	case ScanStatusQueued, ScanStatusProcessing, ScanStatusRunning, ScanStatusAnalyzingPending, ScanStatusAnalyzing:
		return true
	default:
		return false
	}
}

// IsTerminal returns true if the scan status is a terminal (finished) status.
func (s ScanStatus) IsTerminal() bool {
	switch s {
	case ScanStatusComplete, ScanStatusPartial, ScanStatusError, ScanStatusCanceled:
		return true
	default:
		return false
	}
}

// ScanAccountJob is the payload for a scan_account job.
type ScanAccountJob struct {
	JobID     string `json:"job_id"`     // DB job record ID for status tracking
	ScanID    string `json:"scan_id"`    // DB scan record ID for status tracking
	AccountID string `json:"account_id"`
	OrgID     string `json:"org_id"`
}

// AnalyzeJob is the payload for analyze jobs.
type AnalyzeJob struct {
	JobID     string           `json:"job_id"`  // DB job record ID for status tracking
	ScanID    string           `json:"scan_id"` // DB scan record ID to link analyzer to scan
	AccountID string           `json:"account_id"`
	OrgID     string           `json:"org_id"`
	Policy    *ResidencyPolicy `json:"policy,omitempty"`
}

// ResidencyPolicy defines allowed regions for data residency checks.
type ResidencyPolicy struct {
	AllowedRegions []string `json:"allowed_regions"`
}

// Validate checks that required fields are present in ScanAccountJob.
func (j *ScanAccountJob) Validate() error {
	if j.AccountID == "" {
		return errors.New("account_id is required")
	}
	if j.OrgID == "" {
		return errors.New("org_id is required")
	}
	return nil
}

// Validate checks that required fields are present in AnalyzeJob.
func (j *AnalyzeJob) Validate() error {
	if j.AccountID == "" {
		return errors.New("account_id is required")
	}
	if j.OrgID == "" {
		return errors.New("org_id is required")
	}
	return nil
}
