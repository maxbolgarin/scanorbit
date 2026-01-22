package models

import "time"

// FindingSeverity represents the severity level of a finding.
type FindingSeverity string

const (
	SeverityCritical FindingSeverity = "critical"
	SeverityHigh     FindingSeverity = "high"
	SeverityMedium   FindingSeverity = "medium"
	SeverityLow      FindingSeverity = "low"
	SeverityTrivial  FindingSeverity = "trivial"
)

// FindingType represents the type of finding.
type FindingType string

const (
	// Orphan findings
	FindingOrphanedVolume   FindingType = "orphaned_volume"
	FindingOrphanedEIP      FindingType = "orphaned_eip"
	FindingOrphanedSnapshot FindingType = "orphaned_snapshot"
	FindingOrphanedENI      FindingType = "orphaned_eni"
	FindingIdleLoadBalancer FindingType = "idle_load_balancer"
	FindingUnusedSecurityGroup FindingType = "unused_security_group"
	// SSL findings
	FindingSSLExpiry FindingType = "ssl_expiry"
	// Compliance findings
	FindingDataResidency       FindingType = "data_residency_violation"
	FindingCloudtrailDisabled  FindingType = "cloudtrail_disabled"
	FindingVPCFlowLogsDisabled FindingType = "vpc_flow_logs_disabled"
	FindingBackupNotConfigured FindingType = "backup_not_configured"
	// Security findings
	FindingUnencryptedResource   FindingType = "unencrypted_resource"
	FindingPublicAccess          FindingType = "public_access"
	FindingPermissiveSG          FindingType = "permissive_security_group"
	FindingOpenAllPorts          FindingType = "open_all_ports"
	FindingPubliclyAccessibleRDS FindingType = "publicly_accessible_rds"
	FindingPublicSnapshot        FindingType = "public_snapshot"
	FindingInsecureTLS           FindingType = "insecure_tls"
	// Cost findings
	FindingUnusedResource    FindingType = "unused_resource"
	FindingStoppedInstance   FindingType = "stopped_instance"
	FindingUnusedLogGroup    FindingType = "unused_log_group"
	FindingIdleNATGateway    FindingType = "idle_nat_gateway"
	FindingOversizedInstance FindingType = "oversized_instance"
	// Cost optimization findings
	FindingEBSOptimization  FindingType = "ebs_optimization"
	FindingOldGenInstance   FindingType = "old_gen_instance"
	FindingOversizedLambda  FindingType = "oversized_lambda"
	FindingLogRetention     FindingType = "log_retention"
	FindingUnusedKMSKey     FindingType = "unused_kms_key"
	FindingRDSOptimization  FindingType = "rds_optimization"
	FindingOldGenRDS        FindingType = "old_gen_rds"
	// Tagging findings
	FindingMissingTag FindingType = "missing_tag"
	// IAM findings
	FindingOldAccessKey          FindingType = "old_access_key"
	FindingUnusedAccessKey       FindingType = "unused_access_key"
	FindingUnusedIAMRole         FindingType = "unused_iam_role"
	FindingUserWithoutMFA        FindingType = "user_without_mfa"
	FindingRootAccountUsage      FindingType = "root_account_usage"
	FindingOverlyPermissivePolicy FindingType = "overly_permissive_policy"
	FindingCrossAccountTrust     FindingType = "cross_account_trust"
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
	// Lifecycle tracking fields
	FirstDetectedAt time.Time
	LastDetectedAt  time.Time
	DetectionCount  int
	LastScanID      *string
	CreatedAt       time.Time
	UpdatedAt       time.Time
}

// FindingScanStatus represents the detection status of a finding in a scan.
type FindingScanStatus string

const (
	FindingScanDetected    FindingScanStatus = "detected"
	FindingScanNotDetected FindingScanStatus = "not_detected"
)

// FindingScan tracks when a finding was detected in a scan.
type FindingScan struct {
	ID        string
	FindingID string
	ScanID    string
	Status    FindingScanStatus
	CreatedAt time.Time
}

// NewFindingScan creates a new FindingScan record.
func NewFindingScan(findingID, scanID string, status FindingScanStatus) *FindingScan {
	return &FindingScan{
		FindingID: findingID,
		ScanID:    scanID,
		Status:    status,
	}
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
