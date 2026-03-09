package analyzers

import (
	"context"
	"fmt"
	"strings"

	"github.com/google/uuid"
	"github.com/maxbolgarin/scanorbit/internal/models"
	"github.com/maxbolgarin/scanorbit/internal/store"
	"github.com/rs/zerolog"
)

// Default EU regions for GDPR compliance
var defaultEURegions = []string{
	"eu-west-1",    // Ireland
	"eu-west-2",    // London
	"eu-west-3",    // Paris
	"eu-central-1", // Frankfurt
	"eu-central-2", // Zurich
	"eu-north-1",   // Stockholm
	"eu-south-1",   // Milan
	"eu-south-2",   // Spain
}

// ResidencyAnalyzer detects data residency violations.
type ResidencyAnalyzer struct {
	store  *store.Store
	logger zerolog.Logger
}

// NewResidencyAnalyzer creates a new ResidencyAnalyzer.
func NewResidencyAnalyzer(st *store.Store, logger zerolog.Logger) *ResidencyAnalyzer {
	return &ResidencyAnalyzer{
		store:  st,
		logger: logger.With().Str("analyzer", "residency").Logger(),
	}
}

// Name returns the analyzer name.
func (a *ResidencyAnalyzer) Name() string {
	return "residency"
}

// Analyze checks data residency compliance.
func (a *ResidencyAnalyzer) Analyze(ctx context.Context, job *models.AnalyzeJob) ([]*models.Finding, error) {
	a.logger.Info().
		Str("account_id", job.AccountID).
		Str("org_id", job.OrgID).
		Msg("starting data residency analysis")

	// Determine allowed regions
	allowedRegions := defaultEURegions
	if job.Policy != nil && len(job.Policy.AllowedRegions) > 0 {
		allowedRegions = job.Policy.AllowedRegions
	}

	// Create set for quick lookup
	allowedSet := make(map[string]bool)
	for _, r := range allowedRegions {
		allowedSet[r] = true
	}

	// Get all resources for account
	resources, err := a.store.Resources.GetByAccountID(ctx, job.AccountID)
	if err != nil {
		return nil, fmt.Errorf("get resources: %w", err)
	}

	findings := make([]*models.Finding, 0, len(resources))

	for _, r := range resources {
		// Only check data-sensitive services: RDS and S3
		if r.Service != models.ServiceRDS && r.Service != models.ServiceS3 {
			continue
		}

		// Skip if region is empty (shouldn't happen)
		if r.Region == "" {
			continue
		}

		// Check if region is allowed
		if allowedSet[r.Region] {
			continue
		}

		finding := a.createResidencyFinding(r, allowedRegions)
		finding.OrgID = job.OrgID
		finding.AWSAccountID = job.AccountID
		findings = append(findings, finding)
	}

	a.logger.Info().
		Str("account_id", job.AccountID).
		Int("findings", len(findings)).
		Msg("data residency analysis completed")

	return findings, nil
}

// createResidencyFinding creates a finding for a resource in a non-compliant region.
func (a *ResidencyAnalyzer) createResidencyFinding(r *models.Resource, allowedRegions []string) *models.Finding {
	serviceUpper := strings.ToUpper(string(r.Service))
	resourceName := r.Name
	if resourceName == "" {
		resourceName = r.ResourceID
	}

	resourceID := r.ID
	return &models.Finding{
		ID:         uuid.New().String(),
		ResourceID: &resourceID,
		Type:       models.FindingDataResidency,
		Severity:   models.SeverityHigh,
		Summary:    fmt.Sprintf("%s resource '%s' is located in non-compliant region %s", serviceUpper, resourceName, r.Region),
		Details: map[string]any{
			"resource_id":     r.ResourceID,
			"resource_name":   resourceName,
			"service":         string(r.Service),
			"current_region":  r.Region,
			"allowed_regions": allowedRegions,
			"compliance":      "GDPR / Data Residency",
			"recommendation":  fmt.Sprintf("Migrate this %s resource to an allowed region (%s) or request an exception", serviceUpper, strings.Join(allowedRegions, ", ")),
		},
		Status: models.FindingStatusOpen,
	}
}
