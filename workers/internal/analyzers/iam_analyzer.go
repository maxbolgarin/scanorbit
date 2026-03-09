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
	oldAccessKeyDays = 90 // Access key older than 90 days
	unusedRoleDays   = 90 // Role not used in 90 days
)

// IAMAnalyzer detects IAM security best practice violations.
type IAMAnalyzer struct {
	store  *store.Store
	logger zerolog.Logger
}

// NewIAMAnalyzer creates a new IAMAnalyzer.
func NewIAMAnalyzer(st *store.Store, logger zerolog.Logger) *IAMAnalyzer {
	return &IAMAnalyzer{
		store:  st,
		logger: logger.With().Str("analyzer", "iam").Logger(),
	}
}

// Name returns the analyzer name.
func (a *IAMAnalyzer) Name() string {
	return "iam"
}

// Analyze checks for IAM security issues.
func (a *IAMAnalyzer) Analyze(ctx context.Context, job *models.AnalyzeJob) ([]*models.Finding, error) {
	a.logger.Info().
		Str("account_id", job.AccountID).
		Str("org_id", job.OrgID).
		Msg("starting IAM analysis")

	resources, err := a.store.Resources.GetByAccountID(ctx, job.AccountID)
	if err != nil {
		return nil, fmt.Errorf("get resources: %w", err)
	}

	var findings []*models.Finding
	now := time.Now()

	for _, r := range resources {
		var newFindings []*models.Finding

		switch r.Service {
		case models.ServiceIAMUser:
			newFindings = a.checkUserMFA(r)
		case models.ServiceIAMAccessKey:
			newFindings = a.checkAccessKey(r, now)
		case models.ServiceIAMRole:
			newFindings = a.checkUnusedRole(r, now)
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
		Msg("IAM analysis completed")

	return findings, nil
}

// checkUserMFA checks if an IAM user has MFA enabled.
func (a *IAMAnalyzer) checkUserMFA(r *models.Resource) []*models.Finding {
	var raw map[string]any
	if err := json.Unmarshal(r.Raw, &raw); err != nil {
		return nil
	}

	mfaEnabled, ok := raw["mfa_enabled"].(bool)
	if ok && !mfaEnabled {
		resourceID := r.ID
		return []*models.Finding{{
			ID:         uuid.New().String(),
			ResourceID: &resourceID,
			Type:       models.FindingUserWithoutMFA,
			Severity:   models.SeverityHigh,
			Summary:    fmt.Sprintf("IAM user '%s' does not have MFA enabled", r.Name),
			Details: map[string]any{
				"resource_id":    r.ResourceID,
				"user_name":      r.Name,
				"service":        "iam_user",
				"recommendation": "Enable MFA for this IAM user. MFA provides an additional layer of security for AWS account access.",
				"doc_url":        "https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_mfa.html",
			},
			Status: models.FindingStatusOpen,
		}}
	}

	return nil
}

// checkAccessKey checks for old or unused access keys.
func (a *IAMAnalyzer) checkAccessKey(r *models.Resource, now time.Time) []*models.Finding {
	var raw map[string]any
	if err := json.Unmarshal(r.Raw, &raw); err != nil {
		return nil
	}

	var findings []*models.Finding

	// Check key age
	createDateStr, ok := raw["create_date"].(string)
	if ok {
		createDate, err := time.Parse(time.RFC3339, createDateStr)
		if err == nil {
			keyAgeDays := int(now.Sub(createDate).Hours() / 24)
			if keyAgeDays >= oldAccessKeyDays {
				resourceID := r.ID
				userName := getStringValue(raw, "user_name")
				findings = append(findings, &models.Finding{
					ID:         uuid.New().String(),
					ResourceID: &resourceID,
					Type:       models.FindingOldAccessKey,
					Severity:   models.SeverityMedium,
					Summary:    fmt.Sprintf("IAM access key '%s' for user '%s' is %d days old", r.Name, userName, keyAgeDays),
					Details: map[string]any{
						"resource_id":    r.ResourceID,
						"access_key_id":  r.Name,
						"user_name":      userName,
						"service":        "iam_access_key",
						"create_date":    createDateStr,
						"key_age_days":   keyAgeDays,
						"status":         r.State,
						"recommendation": "Rotate this access key. AWS recommends rotating access keys every 90 days.",
						"doc_url":        "https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_access-keys.html",
					},
					Status: models.FindingStatusOpen,
				})
			}
		}
	}

	// Check if key has never been used
	lastUsedDateStr, hasLastUsed := raw["last_used_date"].(string)
	if !hasLastUsed && r.State == "Active" {
		// Key is active but never used
		createDateStr, ok := raw["create_date"].(string)
		if ok {
			createDate, err := time.Parse(time.RFC3339, createDateStr)
			if err == nil {
				keyAgeDays := int(now.Sub(createDate).Hours() / 24)
				if keyAgeDays >= 7 { // Give 7 days grace period for new keys
					resourceID := r.ID
					userName := getStringValue(raw, "user_name")
					findings = append(findings, &models.Finding{
						ID:         uuid.New().String(),
						ResourceID: &resourceID,
						Type:       models.FindingUnusedAccessKey,
						Severity:   models.SeverityLow,
						Summary:    fmt.Sprintf("IAM access key '%s' for user '%s' has never been used", r.Name, userName),
						Details: map[string]any{
							"resource_id":    r.ResourceID,
							"access_key_id":  r.Name,
							"user_name":      userName,
							"service":        "iam_access_key",
							"create_date":    createDateStr,
							"key_age_days":   keyAgeDays,
							"status":         r.State,
							"recommendation": "Delete this access key if not needed. Unused active access keys pose a security risk.",
							"doc_url":        "https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_access-keys.html",
						},
						Status: models.FindingStatusOpen,
					})
				}
			}
		}
	} else if hasLastUsed {
		// Check if key hasn't been used in a long time
		lastUsedDate, err := time.Parse(time.RFC3339, lastUsedDateStr)
		if err == nil {
			daysSinceUsed := int(now.Sub(lastUsedDate).Hours() / 24)
			if daysSinceUsed >= oldAccessKeyDays {
				resourceID := r.ID
				userName := getStringValue(raw, "user_name")
				findings = append(findings, &models.Finding{
					ID:         uuid.New().String(),
					ResourceID: &resourceID,
					Type:       models.FindingUnusedAccessKey,
					Severity:   models.SeverityLow,
					Summary:    fmt.Sprintf("IAM access key '%s' for user '%s' hasn't been used in %d days", r.Name, userName, daysSinceUsed),
					Details: map[string]any{
						"resource_id":     r.ResourceID,
						"access_key_id":   r.Name,
						"user_name":       userName,
						"service":         "iam_access_key",
						"last_used_date":  lastUsedDateStr,
						"days_since_used": daysSinceUsed,
						"status":          r.State,
						"recommendation":  "Delete this access key if no longer needed. Long-unused access keys should be deactivated or deleted.",
						"doc_url":         "https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_access-keys.html",
					},
					Status: models.FindingStatusOpen,
				})
			}
		}
	}

	return findings
}

// checkUnusedRole checks for IAM roles that haven't been used recently.
func (a *IAMAnalyzer) checkUnusedRole(r *models.Resource, now time.Time) []*models.Finding {
	var raw map[string]any
	if err := json.Unmarshal(r.Raw, &raw); err != nil {
		return nil
	}

	// Skip service-linked roles and AWS-managed roles
	roleName := r.Name
	if len(roleName) > 4 && roleName[:4] == "AWS" {
		return nil
	}
	if path, ok := raw["path"].(string); ok && path == "/service-role/" {
		return nil
	}

	lastUsedDateStr, hasLastUsed := raw["last_used_date"].(string)
	if !hasLastUsed {
		// Role has never been used - check creation date
		createDateStr, ok := raw["create_date"].(string)
		if !ok {
			return nil
		}
		createDate, err := time.Parse(time.RFC3339, createDateStr)
		if err != nil {
			return nil
		}
		daysSinceCreated := int(now.Sub(createDate).Hours() / 24)
		if daysSinceCreated >= unusedRoleDays {
			resourceID := r.ID
			return []*models.Finding{{
				ID:         uuid.New().String(),
				ResourceID: &resourceID,
				Type:       models.FindingUnusedIAMRole,
				Severity:   models.SeverityLow,
				Summary:    fmt.Sprintf("IAM role '%s' has never been used (created %d days ago)", r.Name, daysSinceCreated),
				Details: map[string]any{
					"resource_id":        r.ResourceID,
					"role_name":          r.Name,
					"service":            "iam_role",
					"create_date":        createDateStr,
					"days_since_created": daysSinceCreated,
					"recommendation":     "Delete this role if no longer needed. Unused roles increase your security attack surface.",
					"doc_url":            "https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles.html",
				},
				Status: models.FindingStatusOpen,
			}}
		}
		return nil
	}

	lastUsedDate, err := time.Parse(time.RFC3339, lastUsedDateStr)
	if err != nil {
		return nil
	}

	daysSinceUsed := int(now.Sub(lastUsedDate).Hours() / 24)
	if daysSinceUsed >= unusedRoleDays {
		resourceID := r.ID
		return []*models.Finding{{
			ID:         uuid.New().String(),
			ResourceID: &resourceID,
			Type:       models.FindingUnusedIAMRole,
			Severity:   models.SeverityLow,
			Summary:    fmt.Sprintf("IAM role '%s' hasn't been used in %d days", r.Name, daysSinceUsed),
			Details: map[string]any{
				"resource_id":      r.ResourceID,
				"role_name":        r.Name,
				"service":          "iam_role",
				"last_used_date":   lastUsedDateStr,
				"last_used_region": raw["last_used_region"],
				"days_since_used":  daysSinceUsed,
				"recommendation":   "Delete this role if no longer needed. Unused roles increase your security attack surface.",
				"doc_url":          "https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles.html",
			},
			Status: models.FindingStatusOpen,
		}}
	}

	return nil
}
