package analyzers

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/maxbolgarin/scanorbit/internal/models"
	"github.com/maxbolgarin/scanorbit/internal/pricing"
	"github.com/maxbolgarin/scanorbit/internal/store"
	"github.com/rs/zerolog"
)

const (
	orphanedEBSAgeDays      = 7  // Unattached EBS > 7 days
	orphanedEIPAgeDays      = 3  // Unassociated EIP > 3 days
	orphanedSnapshotAgeDays = 30 // Manual RDS snapshot > 30 days
	orphanedENIAgeDays      = 3  // Unattached ENI > 3 days
	idleNATGatewayAgeDays   = 7  // NAT Gateway considered idle if > 7 days old without clear usage
)

// OrphanAnalyzer detects orphaned resources.
type OrphanAnalyzer struct {
	store  *store.Store
	logger zerolog.Logger
}

// NewOrphanAnalyzer creates a new OrphanAnalyzer.
func NewOrphanAnalyzer(st *store.Store, logger zerolog.Logger) *OrphanAnalyzer {
	return &OrphanAnalyzer{
		store:  st,
		logger: logger.With().Str("analyzer", "orphans").Logger(),
	}
}

// Name returns the analyzer name.
func (a *OrphanAnalyzer) Name() string {
	return "orphans"
}

// Analyze detects orphaned resources.
func (a *OrphanAnalyzer) Analyze(ctx context.Context, job *models.AnalyzeJob) ([]*models.Finding, error) {
	a.logger.Info().
		Str("account_id", job.AccountID).
		Str("org_id", job.OrgID).
		Msg("starting orphan analysis")

	// Get all resources for account
	resources, err := a.store.Resources.GetByAccountID(ctx, job.AccountID)
	if err != nil {
		return nil, fmt.Errorf("get resources: %w", err)
	}

	var findings []*models.Finding
	now := time.Now()

	for _, r := range resources {
		var finding *models.Finding

		switch r.Service {
		case models.ServiceEBS:
			finding = a.checkOrphanedEBS(r, now)
		case models.ServiceEIP:
			finding = a.checkOrphanedEIP(r, now)
		case models.ServiceRDSSnapshot:
			finding = a.checkOrphanedSnapshot(r, now)
		case models.ServiceALB:
			finding = a.checkIdleLoadBalancer(r, now)
		case models.ServiceENI:
			finding = a.checkOrphanedENI(r, now)
		case models.ServiceNATGateway:
			finding = a.checkIdleNATGateway(r, now)
		case models.ServiceSecurityGroup:
			finding = a.checkUnusedSecurityGroup(ctx, r, now)
		}

		if finding != nil {
			finding.OrgID = job.OrgID
			finding.AWSAccountID = job.AccountID
			findings = append(findings, finding)
		}
	}

	a.logger.Info().
		Str("account_id", job.AccountID).
		Int("findings", len(findings)).
		Msg("orphan analysis completed")

	return findings, nil
}

// checkOrphanedEBS checks if an EBS volume is orphaned.
func (a *OrphanAnalyzer) checkOrphanedEBS(r *models.Resource, now time.Time) *models.Finding {
	// Rule: Unattached EBS volume > 30 days
	if r.State != "unattached" && r.State != "available" {
		return nil
	}

	// Get volume creation time from raw data for accurate orphan detection
	// We use AWS creation time as the reference point - if a volume was created
	// long ago and is still unattached, it's likely orphaned
	var volumeCreatedAt time.Time
	var raw map[string]any
	if err := json.Unmarshal(r.Raw, &raw); err == nil {
		// Try aws_create_time first (RFC3339 formatted string)
		if createStr, ok := raw["aws_create_time"].(string); ok {
			if parsed, err := time.Parse(time.RFC3339, createStr); err == nil {
				volumeCreatedAt = parsed
			}
		}
	}

	// Fallback to database CreatedAt if AWS time not available
	if volumeCreatedAt.IsZero() {
		volumeCreatedAt = r.CreatedAt
	}

	age := now.Sub(volumeCreatedAt)
	ageDays := int(age.Hours() / 24)

	if ageDays <= orphanedEBSAgeDays {
		return nil
	}

	// Estimate cost based on volume size if available
	estimatedCost := 10.0 // Default rough estimate
	if size, ok := raw["size"].(float64); ok && size > 0 {
		estimatedCost = size * 0.10 // ~$0.10/GB/month for gp2
	}

	resourceID := r.ID
	return &models.Finding{
		ID:         uuid.New().String(),
		ResourceID: &resourceID,
		Type:       models.FindingOrphanedVolume,
		Severity:   models.SeverityMedium,
		Summary:    fmt.Sprintf("Unattached EBS volume %s (unattached for %d days)", r.ResourceID, ageDays),
		Details: map[string]any{
			"resource_id":            r.ResourceID,
			"name":                   r.Name,
			"region":                 r.Region,
			"unattached_days":        ageDays,
			"state":                  r.State,
			"estimated_monthly_cost": estimatedCost,
			"recommendation":         "Delete this volume if no longer needed to save costs",
			"doc_url":                "https://docs.aws.amazon.com/ebs/latest/userguide/ebs-deleting-volume.html",
		},
		Status: models.FindingStatusOpen,
	}
}

// checkOrphanedEIP checks if an EIP is orphaned.
func (a *OrphanAnalyzer) checkOrphanedEIP(r *models.Resource, now time.Time) *models.Finding {
	// Rule: Unassociated EIP > 7 days
	if r.State != "unassociated" {
		return nil
	}

	age := now.Sub(r.CreatedAt)
	ageDays := int(age.Hours() / 24)

	if ageDays <= orphanedEIPAgeDays {
		return nil
	}

	// EIP costs ~$3.60/month when unassociated
	estimatedCost := 3.60

	resourceID := r.ID
	return &models.Finding{
		ID:         uuid.New().String(),
		ResourceID: &resourceID,
		Type:       models.FindingOrphanedEIP,
		Severity:   models.SeverityLow,
		Summary:    fmt.Sprintf("Unassociated Elastic IP %s (age: %d days)", r.Name, ageDays),
		Details: map[string]any{
			"resource_id":            r.ResourceID,
			"public_ip":              r.Name,
			"region":                 r.Region,
			"age_days":               ageDays,
			"estimated_monthly_cost": estimatedCost,
			"recommendation":         "Release this Elastic IP if no longer needed",
			"doc_url":                "https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/elastic-ip-addresses-eip.html",
		},
		Status: models.FindingStatusOpen,
	}
}

// checkOrphanedSnapshot checks if an RDS snapshot is orphaned.
func (a *OrphanAnalyzer) checkOrphanedSnapshot(r *models.Resource, now time.Time) *models.Finding {
	// Rule: Manual RDS snapshot > 90 days
	age := now.Sub(r.CreatedAt)
	ageDays := int(age.Hours() / 24)

	if ageDays <= orphanedSnapshotAgeDays {
		return nil
	}

	// Parse raw data to get snapshot size for cost estimation
	var estimatedCost = 5.0 // Default estimate
	var raw map[string]any
	if err := json.Unmarshal(r.Raw, &raw); err == nil {
		// RDS snapshot storage costs ~$0.095/GB/month
		if allocatedStorage, ok := raw["AllocatedStorage"].(float64); ok && allocatedStorage > 0 {
			estimatedCost = allocatedStorage * 0.095
		}
	}

	resourceID := r.ID
	return &models.Finding{
		ID:         uuid.New().String(),
		ResourceID: &resourceID,
		Type:       models.FindingOrphanedSnapshot,
		Severity:   models.SeverityLow,
		Summary:    fmt.Sprintf("Old manual RDS snapshot %s (age: %d days)", r.ResourceID, ageDays),
		Details: map[string]any{
			"resource_id":            r.ResourceID,
			"name":                   r.Name,
			"region":                 r.Region,
			"age_days":               ageDays,
			"estimated_monthly_cost": estimatedCost,
			"recommendation":         "Delete this snapshot if no longer needed for backup purposes",
			"doc_url":                "https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_DeleteSnapshot.html",
		},
		Status: models.FindingStatusOpen,
	}
}

// checkIdleLoadBalancer checks if an ALB/NLB has no healthy targets.
func (a *OrphanAnalyzer) checkIdleLoadBalancer(r *models.Resource, _ time.Time) *models.Finding {
	// Rule: ALB/NLB with no healthy targets in any target group
	if r.State != "active" {
		return nil
	}

	var raw map[string]any
	if err := json.Unmarshal(r.Raw, &raw); err != nil {
		return nil
	}

	// Get load balancer type (application or network)
	lbType, _ := raw["Type"].(string)
	if lbType == "" {
		lbType = "application" // default to ALB for backwards compatibility
	}

	// Check target groups
	targetGroups, ok := raw["TargetGroups"].([]any)
	if !ok {
		// No target groups = idle load balancer
		return a.createIdleLBFinding(r, 0, 0, lbType)
	}

	totalTargets := 0
	healthyTargets := 0

	for _, tg := range targetGroups {
		tgMap, ok := tg.(map[string]any)
		if !ok {
			continue
		}

		targets, ok := tgMap["Targets"].([]any)
		if !ok {
			continue
		}

		for _, target := range targets {
			totalTargets++
			targetMap, ok := target.(map[string]any)
			if !ok {
				continue
			}

			if healthState, ok := targetMap["HealthState"].(string); ok && healthState == "healthy" {
				healthyTargets++
			}
		}
	}

	// Load balancer is idle if it has no target groups or no healthy targets
	if len(targetGroups) == 0 || totalTargets == 0 || healthyTargets == 0 {
		return a.createIdleLBFinding(r, totalTargets, healthyTargets, lbType)
	}

	return nil
}

// createIdleLBFinding creates a finding for an idle load balancer (ALB or NLB).
func (a *OrphanAnalyzer) createIdleLBFinding(r *models.Resource, totalTargets, healthyTargets int, lbType string) *models.Finding {
	resourceID := r.ID

	// Determine cost and type label based on load balancer type
	var estimatedCost float64
	var lbTypeLabel string
	var docURL string

	switch lbType {
	case "network":
		estimatedCost = pricing.NLBBaseCost
		lbTypeLabel = "NLB"
		docURL = "https://docs.aws.amazon.com/elasticloadbalancing/latest/network/load-balancer-troubleshooting.html"
	default: // "application" or unknown defaults to ALB
		estimatedCost = pricing.ALBBaseCost
		lbTypeLabel = "ALB"
		docURL = "https://docs.aws.amazon.com/elasticloadbalancing/latest/application/load-balancer-troubleshooting.html"
	}

	return &models.Finding{
		ID:         uuid.New().String(),
		ResourceID: &resourceID,
		Type:       models.FindingIdleLoadBalancer,
		Severity:   models.SeverityMedium,
		Summary:    fmt.Sprintf("Idle %s %s (no healthy targets)", lbTypeLabel, r.Name),
		Details: map[string]any{
			"resource_id":            r.ResourceID,
			"name":                   r.Name,
			"region":                 r.Region,
			"lb_type":                lbType,
			"total_targets":          totalTargets,
			"healthy_targets":        healthyTargets,
			"estimated_monthly_cost": estimatedCost,
			"recommendation":         "Delete this load balancer if no longer needed, or register healthy targets",
			"doc_url":                docURL,
		},
		Status: models.FindingStatusOpen,
	}
}

// checkOrphanedENI checks if an ENI is orphaned (unattached for too long).
func (a *OrphanAnalyzer) checkOrphanedENI(r *models.Resource, now time.Time) *models.Finding {
	// Rule: Unattached ENI > 7 days
	// ENI states: available, in-use, attaching, detaching, associated
	if r.State != "available" {
		return nil
	}

	// Parse raw data to check for requester-managed ENIs
	var raw map[string]any
	if err := json.Unmarshal(r.Raw, &raw); err == nil {
		// Skip requester-managed ENIs (created by AWS services like Lambda, RDS, etc.)
		if requesterManaged, ok := raw["requester_managed"].(bool); ok && requesterManaged {
			return nil
		}
		// Skip ENIs with known AWS service requesters
		if requesterID, ok := raw["requester_id"].(string); ok && requesterID != "" {
			// AWS services like ELB, Lambda, RDS create ENIs that shouldn't be flagged
			return nil
		}
	}

	// Use database CreatedAt for age calculation
	age := now.Sub(r.CreatedAt)
	ageDays := int(age.Hours() / 24)

	if ageDays <= orphanedENIAgeDays {
		return nil
	}

	resourceID := r.ID
	return &models.Finding{
		ID:         uuid.New().String(),
		ResourceID: &resourceID,
		Type:       models.FindingOrphanedENI,
		Severity:   models.SeverityLow,
		Summary:    fmt.Sprintf("Unattached network interface %s (unattached for %d days)", r.ResourceID, ageDays),
		Details: map[string]any{
			"resource_id":     r.ResourceID,
			"description":     r.Name,
			"region":          r.Region,
			"unattached_days": ageDays,
			"recommendation":  "Delete this network interface if no longer needed",
			"doc_url":         "https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/using-eni.html",
		},
		Status: models.FindingStatusOpen,
	}
}

// checkUnusedSecurityGroup checks if a security group is not used by any resources.
func (a *OrphanAnalyzer) checkUnusedSecurityGroup(ctx context.Context, r *models.Resource, _ time.Time) *models.Finding {
	// Skip default security groups - they can't be deleted
	var raw map[string]any
	if err := json.Unmarshal(r.Raw, &raw); err == nil {
		if groupName, ok := raw["group_name"].(string); ok && groupName == "default" {
			return nil
		}
	}

	// Check if any resources use this security group via dependencies
	// The security group's ResourceID (e.g., sg-xxx) would be the target in dependencies
	// where relationship type is "uses_sg"
	deps, err := a.store.Dependencies.GetByTarget(ctx, r.ResourceID)
	if err != nil {
		a.logger.Warn().Err(err).Str("sg_id", r.ResourceID).Msg("failed to check security group dependencies")
		return nil
	}

	// If there are any dependencies pointing to this security group, it's in use
	if len(deps) > 0 {
		return nil
	}

	// Security group is not used by any tracked resources
	resourceID := r.ID
	return &models.Finding{
		ID:         uuid.New().String(),
		ResourceID: &resourceID,
		Type:       models.FindingUnusedSecurityGroup,
		Severity:   models.SeverityLow,
		Summary:    fmt.Sprintf("Unused security group %s", r.Name),
		Details: map[string]any{
			"resource_id":    r.ResourceID,
			"name":           r.Name,
			"region":         r.Region,
			"recommendation": "Delete this security group if no longer needed to reduce clutter",
			"doc_url":        "https://docs.aws.amazon.com/vpc/latest/userguide/delete-security-group.html",
		},
		Status: models.FindingStatusOpen,
	}
}

// checkIdleNATGateway checks if a NAT Gateway might be idle.
// Note: True idle detection requires CloudWatch metrics. This check flags
// NAT Gateways that exist for review, as they're expensive (~$32/month).
func (a *OrphanAnalyzer) checkIdleNATGateway(r *models.Resource, now time.Time) *models.Finding {
	// Only check available NAT Gateways
	if r.State != "available" {
		return nil
	}

	// Get creation time from raw data
	var createdAt time.Time
	var raw map[string]any
	if err := json.Unmarshal(r.Raw, &raw); err == nil {
		if createStr, ok := raw["create_time"].(string); ok {
			if parsed, err := time.Parse(time.RFC3339, createStr); err == nil {
				createdAt = parsed
			}
		}
	}

	// Fallback to database CreatedAt
	if createdAt.IsZero() {
		createdAt = r.CreatedAt
	}

	age := now.Sub(createdAt)
	ageDays := int(age.Hours() / 24)

	// Only flag older NAT Gateways for review
	if ageDays <= idleNATGatewayAgeDays {
		return nil
	}

	resourceID := r.ID
	return &models.Finding{
		ID:         uuid.New().String(),
		ResourceID: &resourceID,
		Type:       models.FindingIdleNATGateway,
		Severity:   models.SeverityMedium,
		Summary:    fmt.Sprintf("NAT Gateway %s may be idle (review recommended)", r.Name),
		Details: map[string]any{
			"resource_id":            r.ResourceID,
			"name":                   r.Name,
			"region":                 r.Region,
			"age_days":               ageDays,
			"estimated_monthly_cost": 32.40,
			"recommendation":         "Review CloudWatch metrics to verify traffic. Delete if unused to save ~$32/month",
			"doc_url":                "https://docs.aws.amazon.com/vpc/latest/userguide/vpc-nat-gateway-cloudwatch.html",
		},
		Status: models.FindingStatusOpen,
	}
}
