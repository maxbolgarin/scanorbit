package models

import (
	"errors"
	"fmt"
	"regexp"
)

// Valid scanner types for ScanAccountJob
var validScanners = map[string]bool{
	"ec2":             true,
	"rds":             true,
	"s3":              true,
	"alb":             true,
	"acm":             true,
	"lambda":          true,
	"cloudwatch":      true,
	"iam":             true,
	"security_groups": true,
	"secrets_manager": true,
	"kms":             true,
}

// MaxEnabledScanners is the maximum number of scanners that can be enabled
const MaxEnabledScanners = 20

// uuidRegex validates UUID format
var uuidRegex = regexp.MustCompile(`^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$`)

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
	ScanStatusQueued           ScanStatus = "queued"
	ScanStatusProcessing       ScanStatus = "processing"
	ScanStatusRunning          ScanStatus = "running"
	ScanStatusAnalyzingPending ScanStatus = "analyzing_pending" // Scan done, analyzer jobs created
	ScanStatusAnalyzing        ScanStatus = "analyzing"
	ScanStatusComplete         ScanStatus = "complete"
	ScanStatusPartial          ScanStatus = "partial"
	ScanStatusError            ScanStatus = "error"
	ScanStatusCanceled         ScanStatus = "canceled"
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
	JobID           string   `json:"job_id"`  // DB job record ID for status tracking
	ScanID          string   `json:"scan_id"` // DB scan record ID for status tracking
	AccountID       string   `json:"account_id"`
	OrgID           string   `json:"org_id"`
	EnabledScanners []string `json:"enabled_scanners"` // List of enabled scanner types (e.g., ec2, rds, s3)
}

// AnalyzeJob is the payload for analyze jobs.
type AnalyzeJob struct {
	JobID        string           `json:"job_id"`  // DB job record ID for status tracking
	ScanID       string           `json:"scan_id"` // DB scan record ID to link analyzer to scan
	AccountID    string           `json:"account_id"`
	OrgID        string           `json:"org_id"`
	Policy       *ResidencyPolicy `json:"policy,omitempty"`
	RequiredTags []string         `json:"required_tags,omitempty"` // Required tags from org settings for tagging analyzer
}

// ResidencyPolicy defines allowed regions for data residency checks.
type ResidencyPolicy struct {
	AllowedRegions []string `json:"allowed_regions"`
}

// Validate checks that required fields are present and valid in ScanAccountJob.
func (j *ScanAccountJob) Validate() error {
	if j.AccountID == "" {
		return errors.New("account_id is required")
	}
	if !uuidRegex.MatchString(j.AccountID) {
		return errors.New("account_id must be a valid UUID")
	}

	if j.OrgID == "" {
		return errors.New("org_id is required")
	}
	if !uuidRegex.MatchString(j.OrgID) {
		return errors.New("org_id must be a valid UUID")
	}

	// Validate optional job_id and scan_id if provided
	if j.JobID != "" && !uuidRegex.MatchString(j.JobID) {
		return errors.New("job_id must be a valid UUID")
	}
	if j.ScanID != "" && !uuidRegex.MatchString(j.ScanID) {
		return errors.New("scan_id must be a valid UUID")
	}

	// Validate enabled scanners
	if len(j.EnabledScanners) > MaxEnabledScanners {
		return fmt.Errorf("enabled_scanners cannot exceed %d items", MaxEnabledScanners)
	}
	for _, scanner := range j.EnabledScanners {
		if !validScanners[scanner] {
			return fmt.Errorf("invalid scanner type: %s", scanner)
		}
	}

	return nil
}

// IsScannerEnabled checks if a scanner type is enabled for this job.
// Returns true if EnabledScanners is empty (all enabled) or if the scanner is in the list.
func (j *ScanAccountJob) IsScannerEnabled(scanner string) bool {
	// If EnabledScanners is empty, all scanners are enabled (backward compatibility)
	if len(j.EnabledScanners) == 0 {
		return true
	}
	for _, s := range j.EnabledScanners {
		if s == scanner {
			return true
		}
	}
	return false
}

// Validate checks that required fields are present and valid in AnalyzeJob.
func (j *AnalyzeJob) Validate() error {
	if j.AccountID == "" {
		return errors.New("account_id is required")
	}
	if !uuidRegex.MatchString(j.AccountID) {
		return errors.New("account_id must be a valid UUID")
	}

	if j.OrgID == "" {
		return errors.New("org_id is required")
	}
	if !uuidRegex.MatchString(j.OrgID) {
		return errors.New("org_id must be a valid UUID")
	}

	// Validate optional job_id and scan_id if provided
	if j.JobID != "" && !uuidRegex.MatchString(j.JobID) {
		return errors.New("job_id must be a valid UUID")
	}
	if j.ScanID != "" && !uuidRegex.MatchString(j.ScanID) {
		return errors.New("scan_id must be a valid UUID")
	}

	// Validate residency policy if provided
	if j.Policy != nil && len(j.Policy.AllowedRegions) > 50 {
		return errors.New("allowed_regions cannot exceed 50 items")
	}

	// Validate required tags list
	if len(j.RequiredTags) > 100 {
		return errors.New("required_tags cannot exceed 100 items")
	}

	return nil
}
