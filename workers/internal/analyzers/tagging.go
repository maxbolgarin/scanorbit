package analyzers

import (
	"context"
	"fmt"
	"os"
	"strings"

	"github.com/google/uuid"
	"github.com/maxbolgarin/scanorbit/internal/models"
	"github.com/maxbolgarin/scanorbit/internal/store"
	"github.com/rs/zerolog"
)

// Default required tags - can be overridden via REQUIRED_TAGS env var.
var defaultRequiredTags = []string{"Environment", "Owner", "CostCenter"}

// TaggingAnalyzer detects missing mandatory tags.
type TaggingAnalyzer struct {
	store        *store.Store
	requiredTags []string
	logger       zerolog.Logger
}

// NewTaggingAnalyzer creates a new TaggingAnalyzer.
func NewTaggingAnalyzer(st *store.Store, logger zerolog.Logger) *TaggingAnalyzer {
	requiredTags := defaultRequiredTags
	if envTags := os.Getenv("REQUIRED_TAGS"); envTags != "" {
		requiredTags = strings.Split(envTags, ",")
		for i := range requiredTags {
			requiredTags[i] = strings.TrimSpace(requiredTags[i])
		}
	}

	return &TaggingAnalyzer{
		store:        st,
		requiredTags: requiredTags,
		logger:       logger.With().Str("analyzer", "tagging").Logger(),
	}
}

// Name returns the analyzer name.
func (a *TaggingAnalyzer) Name() string {
	return "tagging"
}

// Analyze checks for missing mandatory tags.
func (a *TaggingAnalyzer) Analyze(ctx context.Context, job *models.AnalyzeJob) ([]*models.Finding, error) {
	// Use tags from job if provided (from org settings), otherwise fall back to default
	requiredTags := a.requiredTags
	if len(job.RequiredTags) > 0 {
		requiredTags = job.RequiredTags
	}

	a.logger.Info().
		Str("account_id", job.AccountID).
		Str("org_id", job.OrgID).
		Strs("required_tags", requiredTags).
		Msg("starting tagging analysis")

	// If no tags are required, skip analysis
	if len(requiredTags) == 0 {
		a.logger.Info().Msg("no required tags configured, skipping tagging analysis")
		return nil, nil
	}

	resources, err := a.store.Resources.GetByAccountID(ctx, job.AccountID)
	if err != nil {
		return nil, fmt.Errorf("get resources: %w", err)
	}

	var findings []*models.Finding

	// Services that typically support tagging
	taggableServices := map[models.ServiceType]bool{
		models.ServiceEC2:             true,
		models.ServiceEBS:             true,
		models.ServiceRDS:             true,
		models.ServiceS3:              true,
		models.ServiceALB:             true,
		models.ServiceLambda:          true,
		models.ServiceSecurityGroup:   true,
		models.ServiceSecret:          true,
		models.ServiceKMSKey:          true,
		models.ServiceCloudWatchLogs:  true,
		models.ServiceCloudWatchAlarm: true,
	}

	for _, r := range resources {
		// Skip resources that don't support tagging
		if !taggableServices[r.Service] {
			continue
		}

		missingTags := a.findMissingTagsWithList(r, requiredTags)
		if len(missingTags) > 0 {
			finding := a.createTaggingFindingWithList(r, missingTags, requiredTags)
			finding.OrgID = job.OrgID
			finding.AWSAccountID = job.AccountID
			findings = append(findings, finding)
		}
	}

	a.logger.Info().
		Str("account_id", job.AccountID).
		Int("findings", len(findings)).
		Msg("tagging analysis completed")

	return findings, nil
}

// findMissingTagsWithList returns a list of required tags that are missing from the resource.
func (a *TaggingAnalyzer) findMissingTagsWithList(r *models.Resource, requiredTags []string) []string {
	var missing []string

	for _, requiredTag := range requiredTags {
		found := false
		// Check case-insensitive match
		for tagKey := range r.Tags {
			if strings.EqualFold(tagKey, requiredTag) {
				// Also check that the tag value is not empty
				if r.Tags[tagKey] != "" {
					found = true
					break
				}
			}
		}
		if !found {
			missing = append(missing, requiredTag)
		}
	}

	return missing
}

// createTaggingFindingWithList creates a finding for a resource with missing tags.
func (a *TaggingAnalyzer) createTaggingFindingWithList(r *models.Resource, missingTags []string, requiredTags []string) *models.Finding {
	serviceUpper := strings.ToUpper(string(r.Service))
	resourceName := r.Name
	if resourceName == "" {
		resourceName = r.ResourceID
	}

	var summary string
	if len(missingTags) == 1 {
		summary = fmt.Sprintf("%s '%s' is missing required tag: %s", serviceUpper, resourceName, missingTags[0])
	} else {
		summary = fmt.Sprintf("%s '%s' is missing %d required tags: %s", serviceUpper, resourceName, len(missingTags), strings.Join(missingTags, ", "))
	}

	resourceID := r.ID
	return &models.Finding{
		ID:         uuid.New().String(),
		ResourceID: &resourceID,
		Type:       models.FindingMissingTag,
		Severity:   models.SeverityTrivial,
		Summary:    summary,
		Details: map[string]any{
			"resource_id":    r.ResourceID,
			"resource_name":  resourceName,
			"service":        string(r.Service),
			"region":         r.Region,
			"missing_tags":   missingTags,
			"existing_tags":  r.Tags,
			"required_tags":  requiredTags,
			"recommendation": fmt.Sprintf("Add the following tags to this resource: %s. Proper tagging helps with cost allocation, security, and resource management.", strings.Join(missingTags, ", ")),
		},
		Status: models.FindingStatusOpen,
	}
}
