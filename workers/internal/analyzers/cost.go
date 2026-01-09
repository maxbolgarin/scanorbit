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
	unusedLambdaDays     = 90 // Lambda not invoked in 90 days
	unusedSecretDays     = 90 // Secret not accessed in 90 days
	stoppedInstanceDays  = 7  // EC2 stopped for 7 days
	unusedLogGroupDays   = 30 // Log group with no recent logs
	unusedLogGroupBytes  = 100 * 1024 * 1024 // 100MB threshold for unused log group cost
)

// CostAnalyzer detects cost optimization opportunities.
type CostAnalyzer struct {
	store  *store.Store
	logger zerolog.Logger
}

// NewCostAnalyzer creates a new CostAnalyzer.
func NewCostAnalyzer(st *store.Store, logger zerolog.Logger) *CostAnalyzer {
	return &CostAnalyzer{
		store:  st,
		logger: logger.With().Str("analyzer", "cost").Logger(),
	}
}

// Name returns the analyzer name.
func (a *CostAnalyzer) Name() string {
	return "cost"
}

// Analyze checks for cost optimization opportunities.
func (a *CostAnalyzer) Analyze(ctx context.Context, job *models.AnalyzeJob) ([]*models.Finding, error) {
	a.logger.Info().
		Str("account_id", job.AccountID).
		Str("org_id", job.OrgID).
		Msg("starting cost analysis")

	resources, err := a.store.Resources.GetByAccountID(ctx, job.AccountID)
	if err != nil {
		return nil, fmt.Errorf("get resources: %w", err)
	}

	var findings []*models.Finding
	now := time.Now()

	for _, r := range resources {
		var newFindings []*models.Finding

		switch r.Service {
		case models.ServiceLambda:
			newFindings = a.checkUnusedLambda(r, now)
		case models.ServiceSecret:
			newFindings = a.checkUnusedSecret(r, now)
		case models.ServiceEC2:
			newFindings = a.checkStoppedInstance(r, now)
		case models.ServiceCloudWatchLogs:
			newFindings = a.checkUnusedLogGroup(r, now)
		}

		for _, f := range newFindings {
			f.OrgID = job.OrgID
			f.AWSAccountID = job.AccountID
			findings = append(findings, f)
		}
	}

	a.logger.Info().
		Str("account_id", job.AccountID).
		Int("findings", len(findings)).
		Msg("cost analysis completed")

	return findings, nil
}

// checkUnusedLambda checks if a Lambda function hasn't been invoked recently.
func (a *CostAnalyzer) checkUnusedLambda(r *models.Resource, now time.Time) []*models.Finding {
	var raw map[string]any
	if err := json.Unmarshal(r.Raw, &raw); err != nil {
		return nil
	}

	lastModifiedStr, ok := raw["last_modified"].(string)
	if !ok {
		return nil
	}

	// Parse last modified time (AWS uses ISO 8601 format)
	lastModified, err := time.Parse(time.RFC3339, lastModifiedStr)
	if err != nil {
		// Try alternative format
		lastModified, err = time.Parse("2006-01-02T15:04:05.000+0000", lastModifiedStr)
		if err != nil {
			return nil
		}
	}

	daysSinceModified := int(now.Sub(lastModified).Hours() / 24)
	if daysSinceModified >= unusedLambdaDays {
		resourceID := r.ID
		return []*models.Finding{{
			ID:         uuid.New().String(),
			ResourceID: &resourceID,
			Type:       models.FindingUnusedResource,
			Severity:   models.SeverityLow,
			Summary:    fmt.Sprintf("Lambda function '%s' hasn't been modified in %d days", r.Name, daysSinceModified),
			Details: map[string]any{
				"resource_id":         r.ResourceID,
				"function_name":       r.Name,
				"service":             "lambda",
				"region":              r.Region,
				"last_modified":       lastModifiedStr,
				"days_since_modified": daysSinceModified,
				"memory_size":         raw["memory_size"],
				"recommendation":      "Review this function and delete if no longer needed. Unused Lambda functions incur storage costs.",
			},
			Status: models.FindingStatusOpen,
		}}
	}

	return nil
}

// checkUnusedSecret checks if a secret hasn't been accessed recently.
func (a *CostAnalyzer) checkUnusedSecret(r *models.Resource, now time.Time) []*models.Finding {
	var raw map[string]any
	if err := json.Unmarshal(r.Raw, &raw); err != nil {
		return nil
	}

	lastAccessedStr, ok := raw["last_accessed_date"].(string)
	if !ok {
		// Secret has never been accessed
		createdStr, ok := raw["created_date"].(string)
		if !ok {
			return nil
		}
		created, err := time.Parse(time.RFC3339, createdStr)
		if err != nil {
			return nil
		}
		daysSinceCreated := int(now.Sub(created).Hours() / 24)
		if daysSinceCreated >= unusedSecretDays {
			resourceID := r.ID
			return []*models.Finding{{
				ID:         uuid.New().String(),
				ResourceID: &resourceID,
				Type:       models.FindingUnusedResource,
				Severity:   models.SeverityLow,
				Summary:    fmt.Sprintf("Secret '%s' has never been accessed (created %d days ago)", r.Name, daysSinceCreated),
				Details: map[string]any{
					"resource_id":        r.ResourceID,
					"secret_name":        r.Name,
					"service":            "secrets_manager",
					"region":             r.Region,
					"created_date":       createdStr,
					"days_since_created": daysSinceCreated,
					"recommendation":     "Review this secret and delete if no longer needed. Unused secrets incur monthly storage costs.",
				},
				Status: models.FindingStatusOpen,
			}}
		}
		return nil
	}

	lastAccessed, err := time.Parse(time.RFC3339, lastAccessedStr)
	if err != nil {
		return nil
	}

	daysSinceAccessed := int(now.Sub(lastAccessed).Hours() / 24)
	if daysSinceAccessed >= unusedSecretDays {
		resourceID := r.ID
		return []*models.Finding{{
			ID:         uuid.New().String(),
			ResourceID: &resourceID,
			Type:       models.FindingUnusedResource,
			Severity:   models.SeverityLow,
			Summary:    fmt.Sprintf("Secret '%s' hasn't been accessed in %d days", r.Name, daysSinceAccessed),
			Details: map[string]any{
				"resource_id":          r.ResourceID,
				"secret_name":          r.Name,
				"service":              "secrets_manager",
				"region":               r.Region,
				"last_accessed_date":   lastAccessedStr,
				"days_since_accessed":  daysSinceAccessed,
				"recommendation":       "Review this secret and delete if no longer needed. Unused secrets incur monthly storage costs.",
			},
			Status: models.FindingStatusOpen,
		}}
	}

	return nil
}

// checkStoppedInstance checks if an EC2 instance has been stopped for too long.
func (a *CostAnalyzer) checkStoppedInstance(r *models.Resource, now time.Time) []*models.Finding {
	if r.State != "stopped" {
		return nil
	}

	var raw map[string]any
	if err := json.Unmarshal(r.Raw, &raw); err != nil {
		return nil
	}

	// Check last seen at to estimate how long it's been stopped
	daysStopped := int(now.Sub(r.LastSeenAt).Hours() / 24)

	// If we just saw it, it hasn't been stopped long
	if daysStopped < stoppedInstanceDays {
		return nil
	}

	resourceID := r.ID
	return []*models.Finding{{
		ID:         uuid.New().String(),
		ResourceID: &resourceID,
		Type:       models.FindingStoppedInstance,
		Severity:   models.SeverityMedium,
		Summary:    fmt.Sprintf("EC2 instance '%s' has been stopped for at least %d days", r.Name, daysStopped),
		Details: map[string]any{
			"resource_id":      r.ResourceID,
			"instance_name":    r.Name,
			"service":          "ec2",
			"region":           r.Region,
			"state":            r.State,
			"instance_type":    raw["instance_type"],
			"days_stopped":     daysStopped,
			"recommendation":   "Stopped instances still incur EBS storage costs. Consider creating an AMI and terminating the instance if no longer needed.",
		},
		Status: models.FindingStatusOpen,
	}}
}

// checkUnusedLogGroup checks for CloudWatch log groups with high storage but no recent activity.
func (a *CostAnalyzer) checkUnusedLogGroup(r *models.Resource, now time.Time) []*models.Finding {
	var raw map[string]any
	if err := json.Unmarshal(r.Raw, &raw); err != nil {
		return nil
	}

	storedBytes, ok := raw["stored_bytes"].(float64)
	if !ok || storedBytes < unusedLogGroupBytes {
		return nil
	}

	// Check if log group has been updated recently
	creationTime, ok := raw["creation_time"].(float64)
	if !ok {
		return nil
	}

	// creation_time is in milliseconds
	created := time.UnixMilli(int64(creationTime))
	daysSinceCreated := int(now.Sub(created).Hours() / 24)

	// Only flag old log groups with high storage
	if daysSinceCreated < unusedLogGroupDays {
		return nil
	}

	// Check retention - if no retention set, it's potentially wasteful
	retentionDays, _ := raw["retention_days"].(float64)

	storedMB := storedBytes / (1024 * 1024)
	resourceID := r.ID

	findings := []*models.Finding{{
		ID:         uuid.New().String(),
		ResourceID: &resourceID,
		Type:       models.FindingUnusedLogGroup,
		Severity:   models.SeverityLow,
		Summary:    fmt.Sprintf("CloudWatch log group '%s' has %.1f MB stored", r.Name, storedMB),
		Details: map[string]any{
			"resource_id":      r.ResourceID,
			"log_group_name":   r.Name,
			"service":          "cloudwatch_logs",
			"region":           r.Region,
			"stored_bytes":     storedBytes,
			"stored_mb":        storedMB,
			"retention_days":   retentionDays,
			"recommendation":   "Set a retention policy to automatically delete old logs, or delete the log group if no longer needed. CloudWatch Logs charges per GB stored.",
		},
		Status: models.FindingStatusOpen,
	}}

	return findings
}
