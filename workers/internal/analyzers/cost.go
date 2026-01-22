package analyzers

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/maxbolgarin/scanorbit/internal/models"
	"github.com/maxbolgarin/scanorbit/internal/pricing"
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
			newFindings = append(newFindings, a.checkOversizedLambda(r, now)...)
		case models.ServiceSecret:
			newFindings = a.checkUnusedSecret(r, now)
		case models.ServiceEC2:
			newFindings = a.checkStoppedInstance(r, now)
			newFindings = append(newFindings, a.checkOldGenInstance(r, now)...)
		case models.ServiceCloudWatchLogs:
			newFindings = a.checkUnusedLogGroup(r, now)
			newFindings = append(newFindings, a.checkLogRetention(r, now)...)
		case models.ServiceEBS:
			newFindings = a.checkGP2toGP3Migration(r, now)
		case models.ServiceRDS:
			newFindings = a.checkRDSOptimization(r, now)
			newFindings = append(newFindings, a.checkOldGenRDS(r, now)...)
		case models.ServiceKMSKey:
			newFindings = a.checkUnusedKMSKey(ctx, r, now)
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
				"note":                "This is based on code modification time, not invocation frequency. Check CloudWatch metrics for actual usage.",
				"recommendation":      "Review this function's CloudWatch invocation metrics. Delete if no longer needed to save storage costs.",
				"doc_url":             "https://docs.aws.amazon.com/lambda/latest/dg/monitoring-cloudwatch.html",
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
					"resource_id":            r.ResourceID,
					"secret_name":            r.Name,
					"service":                "secrets_manager",
					"region":                 r.Region,
					"created_date":           createdStr,
					"days_since_created":     daysSinceCreated,
					"estimated_monthly_cost": 0.40, // Secrets Manager costs $0.40/secret/month
					"recommendation":         "Review this secret and delete if no longer needed. Unused secrets incur monthly storage costs.",
					"doc_url":                "https://docs.aws.amazon.com/secretsmanager/latest/userguide/intro.html",
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
				"resource_id":            r.ResourceID,
				"secret_name":            r.Name,
				"service":                "secrets_manager",
				"region":                 r.Region,
				"last_accessed_date":     lastAccessedStr,
				"days_since_accessed":    daysSinceAccessed,
				"estimated_monthly_cost": 0.40, // Secrets Manager costs $0.40/secret/month
				"recommendation":         "Review this secret and delete if no longer needed. Unused secrets incur monthly storage costs.",
				"doc_url":                "https://docs.aws.amazon.com/secretsmanager/latest/userguide/intro.html",
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

	// Estimate EBS storage cost for attached volumes (~$0.10/GB/month for gp2)
	var estimatedCost float64 = 10.0 // Default estimate
	if blockDevices, ok := raw["BlockDeviceMappings"].([]any); ok {
		var totalGB float64
		for _, bd := range blockDevices {
			bdMap, ok := bd.(map[string]any)
			if !ok {
				continue
			}
			if ebs, ok := bdMap["Ebs"].(map[string]any); ok {
				if volumeSize, ok := ebs["VolumeSize"].(float64); ok {
					totalGB += volumeSize
				}
			}
		}
		if totalGB > 0 {
			estimatedCost = totalGB * 0.10
		}
	}

	resourceID := r.ID
	return []*models.Finding{{
		ID:         uuid.New().String(),
		ResourceID: &resourceID,
		Type:       models.FindingStoppedInstance,
		Severity:   models.SeverityLow,
		Summary:    fmt.Sprintf("EC2 instance '%s' has been stopped for at least %d days", r.Name, daysStopped),
		Details: map[string]any{
			"resource_id":            r.ResourceID,
			"instance_name":          r.Name,
			"service":                "ec2",
			"region":                 r.Region,
			"state":                  r.State,
			"instance_type":          raw["instance_type"],
			"days_stopped":           daysStopped,
			"estimated_monthly_cost": estimatedCost,
			"recommendation":         "Stopped instances still incur EBS storage costs. Consider creating an AMI and terminating the instance if no longer needed.",
			"doc_url":                "https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/creating-an-ami-ebs.html",
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
	storedGB := storedMB / 1024
	// CloudWatch Logs storage costs ~$0.03/GB/month
	estimatedCost := storedGB * 0.03
	if estimatedCost < 0.01 {
		estimatedCost = 0.01 // Minimum threshold
	}

	resourceID := r.ID

	findings := []*models.Finding{{
		ID:         uuid.New().String(),
		ResourceID: &resourceID,
		Type:       models.FindingUnusedLogGroup,
		Severity:   models.SeverityTrivial,
		Summary:    fmt.Sprintf("CloudWatch log group '%s' has %.1f MB stored", r.Name, storedMB),
		Details: map[string]any{
			"resource_id":            r.ResourceID,
			"log_group_name":         r.Name,
			"service":                "cloudwatch_logs",
			"region":                 r.Region,
			"stored_bytes":           storedBytes,
			"stored_mb":              storedMB,
			"retention_days":         retentionDays,
			"estimated_monthly_cost": estimatedCost,
			"recommendation":         "Set a retention policy to automatically delete old logs, or delete the log group if no longer needed. CloudWatch Logs charges per GB stored.",
			"doc_url":                "https://docs.aws.amazon.com/AmazonCloudWatch/latest/logs/Working-with-log-groups-and-streams.html",
		},
		Status: models.FindingStatusOpen,
	}}

	return findings
}

// checkGP2toGP3Migration checks if an EBS volume could benefit from migrating to gp3.
func (a *CostAnalyzer) checkGP2toGP3Migration(r *models.Resource, now time.Time) []*models.Finding {
	var raw map[string]any
	if err := json.Unmarshal(r.Raw, &raw); err != nil {
		return nil
	}

	volumeType, _ := raw["volume_type"].(string)
	if volumeType != "gp2" {
		return nil
	}

	// gp3 is ~20% cheaper than gp2 ($0.08/GB vs $0.10/GB)
	size, _ := raw["size"].(float64)
	if size <= 0 {
		return nil
	}

	// Calculate potential savings (~20% of current cost)
	currentCost := size * 0.10
	newCost := size * 0.08
	savings := currentCost - newCost

	if savings < 0.50 { // Only flag if savings are meaningful
		return nil
	}

	resourceID := r.ID
	return []*models.Finding{{
		ID:         uuid.New().String(),
		ResourceID: &resourceID,
		Type:       models.FindingEBSOptimization,
		Severity:   models.SeverityLow,
		Summary:    fmt.Sprintf("EBS volume '%s' could migrate from gp2 to gp3 (save ~$%.2f/mo)", r.Name, savings),
		Details: map[string]any{
			"resource_id":            r.ResourceID,
			"volume_name":            r.Name,
			"service":                "ebs",
			"region":                 r.Region,
			"volume_type":            volumeType,
			"size_gb":                size,
			"current_monthly_cost":   currentCost,
			"estimated_monthly_cost": savings,
			"recommendation":         "Migrate this gp2 volume to gp3 to save ~20% on storage costs with improved baseline performance.",
			"doc_url":                "https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/ebs-modify-volume.html",
		},
		Status: models.FindingStatusOpen,
	}}
}

// Old generation instance type prefixes that should be upgraded
var oldGenInstancePrefixes = []string{"m4.", "c4.", "r4.", "t2.", "m3.", "c3.", "r3.", "i2.", "d2."}

// Map old gen to recommended new gen
var oldGenUpgradePath = map[string]string{
	"m4": "m6i", "m3": "m6i",
	"c4": "c6i", "c3": "c6i",
	"r4": "r6i", "r3": "r6i",
	"t2": "t3",
	"i2": "i3",
	"d2": "d3",
}

// RDS downsize path map - recommends one size smaller for right-sizing
var rdsDownsizePath = map[string]string{
	// R5 Series
	"db.r5.24xlarge": "db.r5.16xlarge",
	"db.r5.16xlarge": "db.r5.12xlarge",
	"db.r5.12xlarge": "db.r5.8xlarge",
	"db.r5.8xlarge":  "db.r5.4xlarge",
	"db.r5.4xlarge":  "db.r5.2xlarge",
	// R6i Series
	"db.r6i.24xlarge": "db.r6i.16xlarge",
	"db.r6i.16xlarge": "db.r6i.12xlarge",
	"db.r6i.12xlarge": "db.r6i.8xlarge",
	"db.r6i.8xlarge":  "db.r6i.4xlarge",
	"db.r6i.4xlarge":  "db.r6i.2xlarge",
	// R6g Series (Graviton)
	"db.r6g.16xlarge": "db.r6g.12xlarge",
	"db.r6g.12xlarge": "db.r6g.8xlarge",
	"db.r6g.8xlarge":  "db.r6g.4xlarge",
	"db.r6g.4xlarge":  "db.r6g.2xlarge",
	// M5 Series
	"db.m5.24xlarge": "db.m5.16xlarge",
	"db.m5.16xlarge": "db.m5.12xlarge",
	"db.m5.12xlarge": "db.m5.8xlarge",
	"db.m5.8xlarge":  "db.m5.4xlarge",
	"db.m5.4xlarge":  "db.m5.2xlarge",
	// M6i Series
	"db.m6i.24xlarge": "db.m6i.16xlarge",
	"db.m6i.16xlarge": "db.m6i.12xlarge",
	"db.m6i.12xlarge": "db.m6i.8xlarge",
	"db.m6i.8xlarge":  "db.m6i.4xlarge",
	"db.m6i.4xlarge":  "db.m6i.2xlarge",
	// M6g Series (Graviton)
	"db.m6g.16xlarge": "db.m6g.12xlarge",
	"db.m6g.12xlarge": "db.m6g.8xlarge",
	"db.m6g.8xlarge":  "db.m6g.4xlarge",
	"db.m6g.4xlarge":  "db.m6g.2xlarge",
}

// RDS old generation upgrade path
var rdsOldGenUpgrade = map[string]string{
	// M4 -> M6i
	"db.m4.large":    "db.m6i.large",
	"db.m4.xlarge":   "db.m6i.xlarge",
	"db.m4.2xlarge":  "db.m6i.2xlarge",
	"db.m4.4xlarge":  "db.m6i.4xlarge",
	"db.m4.10xlarge": "db.m6i.12xlarge",
	"db.m4.16xlarge": "db.m6i.16xlarge",
	// R4 -> R6i
	"db.r4.large":    "db.r6i.large",
	"db.r4.xlarge":   "db.r6i.xlarge",
	"db.r4.2xlarge":  "db.r6i.2xlarge",
	"db.r4.4xlarge":  "db.r6i.4xlarge",
	"db.r4.8xlarge":  "db.r6i.8xlarge",
	"db.r4.16xlarge": "db.r6i.16xlarge",
	// T2 -> T4g (Graviton)
	"db.t2.micro":  "db.t4g.micro",
	"db.t2.small":  "db.t4g.small",
	"db.t2.medium": "db.t4g.medium",
	"db.t2.large":  "db.t4g.large",
	// M3 -> M6i
	"db.m3.medium":  "db.m6i.large",
	"db.m3.large":   "db.m6i.large",
	"db.m3.xlarge":  "db.m6i.xlarge",
	"db.m3.2xlarge": "db.m6i.2xlarge",
	// R3 -> R6i
	"db.r3.large":   "db.r6i.large",
	"db.r3.xlarge":  "db.r6i.xlarge",
	"db.r3.2xlarge": "db.r6i.2xlarge",
	"db.r3.4xlarge": "db.r6i.4xlarge",
	"db.r3.8xlarge": "db.r6i.8xlarge",
}

// Old generation RDS instance prefixes
var rdsOldGenPrefixes = []string{"db.m4.", "db.r4.", "db.t2.", "db.m3.", "db.r3."}

// checkOldGenInstance checks if an EC2 instance uses an old generation instance type.
func (a *CostAnalyzer) checkOldGenInstance(r *models.Resource, now time.Time) []*models.Finding {
	if r.State != "running" {
		return nil
	}

	var raw map[string]any
	if err := json.Unmarshal(r.Raw, &raw); err != nil {
		return nil
	}

	instanceType, _ := raw["instance_type"].(string)
	if instanceType == "" {
		return nil
	}

	var isOldGen bool
	var oldFamily string
	for _, prefix := range oldGenInstancePrefixes {
		if strings.HasPrefix(instanceType, prefix) {
			isOldGen = true
			oldFamily = prefix[:2]
			break
		}
	}

	if !isOldGen {
		return nil
	}

	newFamily := oldGenUpgradePath[oldFamily]
	if newFamily == "" {
		newFamily = "current generation"
	}

	resourceID := r.ID
	return []*models.Finding{{
		ID:         uuid.New().String(),
		ResourceID: &resourceID,
		Type:       models.FindingOldGenInstance,
		Severity:   models.SeverityLow,
		Summary:    fmt.Sprintf("EC2 instance '%s' uses old generation type %s", r.Name, instanceType),
		Details: map[string]any{
			"resource_id":            r.ResourceID,
			"instance_name":          r.Name,
			"service":                "ec2",
			"region":                 r.Region,
			"instance_type":          instanceType,
			"recommended_family":     newFamily,
			"estimated_monthly_cost": 10.0, // Estimate: 10-20% of instance cost typically
			"recommendation":         fmt.Sprintf("Consider migrating to %s instance family for better price-performance (typically 10-20%% cheaper).", newFamily),
			"doc_url":                "https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/instance-types.html",
		},
		Status: models.FindingStatusOpen,
	}}
}

// checkOversizedLambda checks if a Lambda function has more memory than needed.
func (a *CostAnalyzer) checkOversizedLambda(r *models.Resource, now time.Time) []*models.Finding {
	var raw map[string]any
	if err := json.Unmarshal(r.Raw, &raw); err != nil {
		return nil
	}

	memorySize, _ := raw["memory_size"].(float64)
	if memorySize <= 1024 { // Only flag functions with >1GB memory
		return nil
	}

	// Check if the function hasn't been modified recently
	lastModifiedStr, _ := raw["last_modified"].(string)
	if lastModifiedStr == "" {
		return nil
	}

	lastModified, err := time.Parse(time.RFC3339, lastModifiedStr)
	if err != nil {
		// Try alternative format
		lastModified, err = time.Parse("2006-01-02T15:04:05.000+0000", lastModifiedStr)
		if err != nil {
			return nil
		}
	}

	daysSinceModified := int(now.Sub(lastModified).Hours() / 24)
	if daysSinceModified < 30 { // Only flag if not modified in 30 days
		return nil
	}

	// Estimate potential savings from right-sizing
	// Lambda costs $0.0000166667 per GB-second
	// If memory is 2x what's needed, potential savings are significant
	excessMemoryMB := memorySize - 512 // Assuming 512MB might be sufficient
	potentialSavings := (excessMemoryMB / 1024) * 0.0000166667 * 1000000 * 0.1 // Rough estimate

	resourceID := r.ID
	return []*models.Finding{{
		ID:         uuid.New().String(),
		ResourceID: &resourceID,
		Type:       models.FindingOversizedLambda,
		Severity:   models.SeverityLow,
		Summary:    fmt.Sprintf("Lambda '%s' may be over-provisioned with %dMB memory", r.Name, int(memorySize)),
		Details: map[string]any{
			"resource_id":            r.ResourceID,
			"function_name":          r.Name,
			"service":                "lambda",
			"region":                 r.Region,
			"memory_size":            memorySize,
			"days_since_modified":    daysSinceModified,
			"estimated_monthly_cost": potentialSavings,
			"recommendation":         "Use Lambda Power Tuning to find optimal memory configuration. Over-provisioned memory increases costs.",
			"doc_url":                "https://docs.aws.amazon.com/lambda/latest/operatorguide/profile-functions.html",
		},
		Status: models.FindingStatusOpen,
	}}
}

// checkLogRetention checks if a CloudWatch log group has no retention policy.
func (a *CostAnalyzer) checkLogRetention(r *models.Resource, now time.Time) []*models.Finding {
	var raw map[string]any
	if err := json.Unmarshal(r.Raw, &raw); err != nil {
		return nil
	}

	// Check if retention is set (0 or missing means infinite retention)
	retentionDays, hasRetention := raw["retention_days"].(float64)
	if hasRetention && retentionDays > 0 {
		return nil
	}

	storedBytes, _ := raw["stored_bytes"].(float64)
	// Only flag if storage is significant (>1GB)
	if storedBytes < 1024*1024*1024 {
		return nil
	}

	storedGB := storedBytes / (1024 * 1024 * 1024)
	// Estimate potential savings if retention was set to 30 days
	// With infinite retention, logs accumulate. Estimate ~50% could be saved with proper retention
	potentialSavings := storedGB * 0.03 * 0.5

	resourceID := r.ID
	return []*models.Finding{{
		ID:         uuid.New().String(),
		ResourceID: &resourceID,
		Type:       models.FindingLogRetention,
		Severity:   models.SeverityLow,
		Summary:    fmt.Sprintf("Log group '%s' has no retention policy (%.1f GB stored)", r.Name, storedGB),
		Details: map[string]any{
			"resource_id":            r.ResourceID,
			"log_group_name":         r.Name,
			"service":                "cloudwatch_logs",
			"region":                 r.Region,
			"stored_bytes":           storedBytes,
			"stored_gb":              storedGB,
			"estimated_monthly_cost": potentialSavings,
			"recommendation":         "Set a retention policy to automatically delete old logs. Infinite retention causes storage costs to grow indefinitely.",
			"doc_url":                "https://docs.aws.amazon.com/AmazonCloudWatch/latest/logs/Working-with-log-groups-and-streams.html",
		},
		Status: models.FindingStatusOpen,
	}}
}

// checkUnusedKMSKey checks if a KMS key is not being used.
func (a *CostAnalyzer) checkUnusedKMSKey(ctx context.Context, r *models.Resource, now time.Time) []*models.Finding {
	var raw map[string]any
	if err := json.Unmarshal(r.Raw, &raw); err != nil {
		return nil
	}

	// Only check customer-managed keys (not AWS managed)
	keyManager, _ := raw["key_manager"].(string)
	if keyManager == "AWS" {
		return nil
	}

	// Check key state - only flag enabled keys
	keyState, _ := raw["key_state"].(string)
	if keyState != "Enabled" {
		return nil
	}

	// Check if any resources use this key via dependencies
	deps, err := a.store.Dependencies.GetByTarget(ctx, r.ResourceID)
	if err != nil {
		a.logger.Warn().Err(err).Str("key_id", r.ResourceID).Msg("failed to check KMS key dependencies")
		return nil
	}

	// If there are any dependencies, the key is in use
	if len(deps) > 0 {
		return nil
	}

	// KMS customer-managed key costs $1/month
	resourceID := r.ID
	return []*models.Finding{{
		ID:         uuid.New().String(),
		ResourceID: &resourceID,
		Type:       models.FindingUnusedKMSKey,
		Severity:   models.SeverityLow,
		Summary:    fmt.Sprintf("KMS key '%s' is not used by any tracked resources", r.Name),
		Details: map[string]any{
			"resource_id":            r.ResourceID,
			"key_alias":              r.Name,
			"service":                "kms",
			"region":                 r.Region,
			"key_state":              keyState,
			"estimated_monthly_cost": 1.0,
			"recommendation":         "Review this KMS key. If no longer needed, schedule it for deletion to save $1/month.",
			"doc_url":                "https://docs.aws.amazon.com/kms/latest/developerguide/deleting-keys.html",
		},
		Status: models.FindingStatusOpen,
	}}
}

// checkRDSOptimization checks for RDS optimization opportunities.
func (a *CostAnalyzer) checkRDSOptimization(r *models.Resource, now time.Time) []*models.Finding {
	var raw map[string]any
	if err := json.Unmarshal(r.Raw, &raw); err != nil {
		return nil
	}

	instanceClass, _ := raw["DBInstanceClass"].(string)
	if instanceClass == "" {
		return nil
	}

	// Extract MultiAZ setting
	multiAZ, _ := raw["MultiAZ"].(bool)

	// Check if this is a large instance that can be downsized
	recommendedClass, hasDownsizePath := rdsDownsizePath[instanceClass]

	if !hasDownsizePath {
		return nil
	}

	// Calculate actual savings based on pricing
	currentCost := pricing.GetRDSCost(instanceClass, multiAZ)
	recommendedCost := pricing.GetRDSCost(recommendedClass, multiAZ)
	estimatedSavings := currentCost - recommendedCost

	// Only flag if savings are significant (at least $50/month)
	if estimatedSavings < 50 {
		return nil
	}

	resourceID := r.ID
	return []*models.Finding{{
		ID:         uuid.New().String(),
		ResourceID: &resourceID,
		Type:       models.FindingRDSOptimization,
		Severity:   models.SeverityLow,
		Summary:    fmt.Sprintf("Large RDS instance '%s' (%s) - consider downsizing to %s", r.Name, instanceClass, recommendedClass),
		Details: map[string]any{
			"resource_id":            r.ResourceID,
			"db_name":                r.Name,
			"service":                "rds",
			"region":                 r.Region,
			"instance_class":         instanceClass,
			"recommended_class":      recommendedClass,
			"multi_az":               multiAZ,
			"current_monthly_cost":   currentCost,
			"recommended_cost":       recommendedCost,
			"estimated_monthly_cost": estimatedSavings,
			"recommendation":         fmt.Sprintf("Review CloudWatch metrics. If CPU/memory utilization is consistently below 40%%, consider downsizing from %s to %s to save ~$%.0f/month.", instanceClass, recommendedClass, estimatedSavings),
			"doc_url":                "https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_PerfInsights.html",
		},
		Status: models.FindingStatusOpen,
	}}
}

// checkOldGenRDS checks if an RDS instance uses an old generation instance type.
func (a *CostAnalyzer) checkOldGenRDS(r *models.Resource, now time.Time) []*models.Finding {
	var raw map[string]any
	if err := json.Unmarshal(r.Raw, &raw); err != nil {
		return nil
	}

	instanceClass, _ := raw["DBInstanceClass"].(string)
	if instanceClass == "" {
		return nil
	}

	// Check if this is an old generation instance
	var isOldGen bool
	for _, prefix := range rdsOldGenPrefixes {
		if strings.HasPrefix(instanceClass, prefix) {
			isOldGen = true
			break
		}
	}

	if !isOldGen {
		return nil
	}

	// Look up recommended upgrade path
	recommendedClass, ok := rdsOldGenUpgrade[instanceClass]
	if !ok {
		// No exact match, try to infer recommendation based on family
		recommendedClass = "current generation equivalent"
	}

	// Extract MultiAZ setting for cost calculation
	multiAZ, _ := raw["MultiAZ"].(bool)

	// Get current cost (old gen pricing may not be in our map, estimate based on similar new gen)
	currentCost := pricing.GetRDSCost(instanceClass, multiAZ)

	// New generation instances are typically same price or cheaper with better performance
	// Estimate 10-15% effective savings from better price-performance
	estimatedSavings := currentCost * 0.10 // 10% of current cost as conservative estimate

	// Only flag if the instance has meaningful cost
	if currentCost < 50 {
		estimatedSavings = 5.0 // Minimum savings estimate for small instances
	}

	resourceID := r.ID
	return []*models.Finding{{
		ID:         uuid.New().String(),
		ResourceID: &resourceID,
		Type:       models.FindingOldGenRDS,
		Severity:   models.SeverityLow,
		Summary:    fmt.Sprintf("RDS instance '%s' uses old generation %s - consider upgrading to %s", r.Name, instanceClass, recommendedClass),
		Details: map[string]any{
			"resource_id":            r.ResourceID,
			"db_name":                r.Name,
			"service":                "rds",
			"region":                 r.Region,
			"instance_class":         instanceClass,
			"recommended_class":      recommendedClass,
			"multi_az":               multiAZ,
			"current_monthly_cost":   currentCost,
			"estimated_monthly_cost": estimatedSavings,
			"recommendation":         fmt.Sprintf("Upgrade from %s to %s for better price-performance. New generation instances offer improved performance at similar or lower cost (typically 10-15%% better value).", instanceClass, recommendedClass),
			"doc_url":                "https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/Concepts.DBInstanceClass.html",
		},
		Status: models.FindingStatusOpen,
	}}
}
