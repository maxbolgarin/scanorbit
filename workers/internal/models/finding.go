package models

import "time"

// FindingSeverity represents the severity level of a finding.
type FindingSeverity string

const (
	SeverityLow    FindingSeverity = "low"
	SeverityMedium FindingSeverity = "medium"
	SeverityHigh   FindingSeverity = "high"
)

// FindingType represents the type of finding.
type FindingType string

const (
	FindingOrphanedVolume   FindingType = "orphaned_volume"
	FindingOrphanedEIP      FindingType = "orphaned_eip"
	FindingOrphanedSnapshot FindingType = "orphaned_snapshot"
	FindingSSLExpiry        FindingType = "ssl_expiry"
	FindingDataResidency    FindingType = "data_residency_violation"
)

// FindingStatus represents the status of a finding.
type FindingStatus string

const (
	FindingStatusOpen     FindingStatus = "open"
	FindingStatusResolved FindingStatus = "resolved"
	FindingStatusSnoozed  FindingStatus = "snoozed"
	FindingStatusIgnored  FindingStatus = "ignored"
)

// Finding represents a security or optimization finding.
type Finding struct {
	ID            string
	OrgID         string
	AWSAccountID  string
	ResourceID    *string // Nullable FK to resources
	CertificateID *string // Nullable FK to certificates
	Type          FindingType
	Severity      FindingSeverity
	Summary       string
	Details       map[string]any
	Status        FindingStatus
	CreatedAt     time.Time
	UpdatedAt     time.Time
}

// NewFinding creates a new Finding with sensible defaults.
func NewFinding(findingType FindingType, severity FindingSeverity, summary string) *Finding {
	return &Finding{
		Type:     findingType,
		Severity: severity,
		Summary:  summary,
		Details:  make(map[string]any),
		Status:   FindingStatusOpen,
	}
}

// WithResource sets the resource ID for the finding.
func (f *Finding) WithResource(resourceID string) *Finding {
	f.ResourceID = &resourceID
	return f
}

// WithCertificate sets the certificate ID for the finding.
func (f *Finding) WithCertificate(certificateID string) *Finding {
	f.CertificateID = &certificateID
	return f
}

// AddDetail adds a detail to the finding.
func (f *Finding) AddDetail(key string, value any) *Finding {
	f.Details[key] = value
	return f
}
