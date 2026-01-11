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
