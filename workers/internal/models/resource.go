package models

import (
	"encoding/json"
	"time"
)

// ServiceType represents the type of AWS service.
type ServiceType string

const (
	ServiceEC2             ServiceType = "ec2"
	ServiceEBS             ServiceType = "ebs"
	ServiceEIP             ServiceType = "eip"
	ServiceRDS             ServiceType = "rds"
	ServiceRDSSnapshot     ServiceType = "rds_snapshot"
	ServiceS3              ServiceType = "s3"
	ServiceALB             ServiceType = "alb"
	ServiceACM             ServiceType = "acm"
	ServiceLambda          ServiceType = "lambda"
	ServiceCloudWatchLogs  ServiceType = "cloudwatch_logs"
	ServiceCloudWatchAlarm ServiceType = "cloudwatch_alarm"
	ServiceIAMUser         ServiceType = "iam_user"
	ServiceIAMRole         ServiceType = "iam_role"
	ServiceIAMPolicy       ServiceType = "iam_policy"
	ServiceIAMAccessKey    ServiceType = "iam_access_key"
	ServiceSecurityGroup   ServiceType = "security_group"
	ServiceSecret          ServiceType = "secret"
	ServiceKMSKey          ServiceType = "kms_key"
	ServiceENI             ServiceType = "eni"
	ServiceNATGateway      ServiceType = "nat_gateway"
	// Dependency target types (not scanned, but referenced in relationships)
	ServiceVPC         ServiceType = "vpc"
	ServiceSubnet      ServiceType = "subnet"
	ServiceTargetGroup ServiceType = "target_group"
	ServiceLambdaLayer ServiceType = "lambda_layer"
)

// Resource represents an AWS resource discovered during scanning.
type Resource struct {
	ID                  string
	OrgID               string
	AWSAccountID        string
	ResourceID          string // AWS resource identifier (e.g., i-xxx, vol-xxx)
	Service             ServiceType
	Region              string
	Name                string
	State               string
	Tags                map[string]string
	CostEstimateMonthly float64
	LastSeenAt          time.Time
	Raw                 json.RawMessage // Full AWS API response
	CreatedAt           time.Time
}

// NewResource creates a new Resource with sensible defaults.
func NewResource(resourceID string, service ServiceType, region string) *Resource {
	return &Resource{
		ResourceID: resourceID,
		Service:    service,
		Region:     region,
		Tags:       make(map[string]string),
		LastSeenAt: time.Now(),
	}
}

// RelationshipType represents the type of relationship between resources.
type RelationshipType string

const (
	RelationshipUsesRole    RelationshipType = "uses_role"    // Lambda/EC2 → IAM Role
	RelationshipInVPC       RelationshipType = "in_vpc"       // EC2/RDS/Lambda → VPC
	RelationshipInSubnet    RelationshipType = "in_subnet"    // EC2/RDS/ENI → Subnet
	RelationshipUsesSG      RelationshipType = "uses_sg"      // EC2/RDS/Lambda/ENI → Security Group
	RelationshipAttachedTo  RelationshipType = "attached_to"  // EBS/ENI → EC2
	RelationshipTargets     RelationshipType = "targets"      // Target Group → EC2/Lambda
	RelationshipOwns        RelationshipType = "owns"         // ALB → Target Group
	RelationshipUsesLayer   RelationshipType = "uses_layer"   // Lambda → Lambda Layer
	RelationshipEncryptedBy RelationshipType = "encrypted_by" // EBS/RDS/S3 → KMS Key
)

// ResourceDependency represents a relationship between two resources.
type ResourceDependency struct {
	ID               string
	OrgID            string
	SourceResourceID string           // UUID of source resource in our DB
	TargetResourceID string           // AWS ARN/ID of target (may not be in our DB)
	TargetService    ServiceType      // Service type of target resource
	RelationshipType RelationshipType // Type of relationship
	CreatedAt        time.Time
}

// NewResourceDependency creates a new ResourceDependency.
func NewResourceDependency(sourceID, targetID string, targetService ServiceType, relType RelationshipType) *ResourceDependency {
	return &ResourceDependency{
		SourceResourceID: sourceID,
		TargetResourceID: targetID,
		TargetService:    targetService,
		RelationshipType: relType,
	}
}

// ResourceScanStatus represents the status of a resource in a specific scan.
type ResourceScanStatus string

const (
	ResourceScanStatusNew     ResourceScanStatus = "new"     // Resource discovered for the first time
	ResourceScanStatusUpdated ResourceScanStatus = "updated" // Resource re-discovered in scan
	ResourceScanStatusRemoved ResourceScanStatus = "removed" // Resource was in previous scan but not in current
)

// ResourceScan represents the relationship between a resource and a scan (scan history).
type ResourceScan struct {
	ID         string
	ResourceID string
	ScanID     string
	Status     ResourceScanStatus
	CreatedAt  time.Time
}

// NewResourceScan creates a new ResourceScan record.
func NewResourceScan(resourceID, scanID string, status ResourceScanStatus) *ResourceScan {
	return &ResourceScan{
		ResourceID: resourceID,
		ScanID:     scanID,
		Status:     status,
		CreatedAt:  time.Now(),
	}
}
