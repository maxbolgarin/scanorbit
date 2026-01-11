package analyzers

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/maxbolgarin/scanorbit/internal/models"
	"github.com/maxbolgarin/scanorbit/internal/store"
	"github.com/rs/zerolog"
)

const (
	orphanedEBSAgeDays      = 30  // Unattached EBS > 30 days
	orphanedEIPAgeDays      = 7   // Unassociated EIP > 7 days
	orphanedSnapshotAgeDays = 90  // Manual RDS snapshot > 90 days
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

	// Try to get unattached_since from raw data for more accurate tracking
	var unattachedSince time.Time
	var raw map[string]any
	if err := json.Unmarshal(r.Raw, &raw); err == nil {
		if unattachedStr, ok := raw["unattached_since"].(string); ok {
			if parsed, err := time.Parse(time.RFC3339, unattachedStr); err == nil {
				unattachedSince = parsed
			}
		}
	}

	// Fallback to CreatedAt if no unattached_since timestamp available
	if unattachedSince.IsZero() {
		unattachedSince = r.CreatedAt
	}

	age := now.Sub(unattachedSince)
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

	resourceID := r.ID
	return &models.Finding{
		ID:         uuid.New().String(),
		ResourceID: &resourceID,
		Type:       models.FindingOrphanedSnapshot,
		Severity:   models.SeverityLow,
		Summary:    fmt.Sprintf("Old manual RDS snapshot %s (age: %d days)", r.ResourceID, ageDays),
		Details: map[string]any{
			"resource_id":    r.ResourceID,
			"name":           r.Name,
			"region":         r.Region,
			"age_days":       ageDays,
			"recommendation": "Delete this snapshot if no longer needed for backup purposes",
		},
		Status: models.FindingStatusOpen,
	}
}
