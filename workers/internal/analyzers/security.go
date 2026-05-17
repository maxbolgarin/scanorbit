package analyzers

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/google/uuid"
	"github.com/maxbolgarin/scanorbit/internal/models"
	"github.com/maxbolgarin/scanorbit/internal/store"
	"github.com/rs/zerolog"
)

// Sensitive ports that should not be open to the world.
var sensitivePorts = map[int32]string{
	22:    "SSH",
	3389:  "RDP",
	3306:  "MySQL",
	5432:  "PostgreSQL",
	1433:  "MSSQL",
	27017: "MongoDB",
	6379:  "Redis",
	9200:  "Elasticsearch",
	5672:  "RabbitMQ",
	11211: "Memcached",
}

// SecurityAnalyzer detects security issues like unencrypted resources and permissive security groups.
type SecurityAnalyzer struct {
	store  *store.Store
	logger zerolog.Logger
}

// NewSecurityAnalyzer creates a new SecurityAnalyzer.
func NewSecurityAnalyzer(st *store.Store, logger zerolog.Logger) *SecurityAnalyzer {
	return &SecurityAnalyzer{
		store:  st,
		logger: logger.With().Str("analyzer", "security").Logger(),
	}
}

// Name returns the analyzer name.
func (a *SecurityAnalyzer) Name() string {
	return "security"
}

// Analyze checks for security issues.
func (a *SecurityAnalyzer) Analyze(ctx context.Context, job *models.AnalyzeJob) ([]*models.Finding, error) {
	a.logger.Info().
		Str("account_id", job.AccountID).
		Str("org_id", job.OrgID).
		Msg("starting security analysis")

	resources, err := a.store.Resources.GetByAccountID(ctx, job.AccountID)
	if err != nil {
		return nil, fmt.Errorf("get resources: %w", err)
	}

	var findings []*models.Finding

	for _, r := range resources {
		var newFindings []*models.Finding

		switch r.Service {
		case models.ServiceEBS:
			newFindings = a.checkEBSEncryption(r)
		case models.ServiceRDS:
			newFindings = a.checkRDSEncryption(r)
		case models.ServiceS3:
			newFindings = a.checkS3PublicAccess(r)
		case models.ServiceSecurityGroup:
			newFindings = a.checkSecurityGroup(r)
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
		Msg("security analysis completed")

	return findings, nil
}

// checkEBSEncryption checks if an EBS volume is encrypted.
func (a *SecurityAnalyzer) checkEBSEncryption(r *models.Resource) []*models.Finding {
	var raw map[string]any
	if err := json.Unmarshal(r.Raw, &raw); err != nil {
		return nil
	}

	encrypted, ok := raw["encrypted"].(bool)
	if ok && !encrypted {
		resourceID := r.ID
		return []*models.Finding{{
			ID:         uuid.New().String(),
			ResourceID: &resourceID,
			Type:       models.FindingUnencryptedResource,
			Severity:   models.SeverityMedium,
			Summary:    fmt.Sprintf("EBS volume '%s' is not encrypted", r.Name),
			Details: map[string]any{
				"resource_id":    r.ResourceID,
				"resource_name":  r.Name,
				"service":        "ebs",
				"region":         r.Region,
				"recommendation": "Enable encryption for this EBS volume. For existing volumes, create an encrypted snapshot and restore to a new encrypted volume.",
				"doc_url":        "https://docs.aws.amazon.com/ebs/latest/userguide/ebs-encryption.html",
			},
			Status: models.FindingStatusOpen,
		}}
	}

	return nil
}

// checkRDSEncryption checks if an RDS instance is encrypted.
func (a *SecurityAnalyzer) checkRDSEncryption(r *models.Resource) []*models.Finding {
	var raw map[string]any
	if err := json.Unmarshal(r.Raw, &raw); err != nil {
		return nil
	}

	storageEncrypted, ok := raw["storage_encrypted"].(bool)
	if ok && !storageEncrypted {
		resourceID := r.ID
		return []*models.Finding{{
			ID:         uuid.New().String(),
			ResourceID: &resourceID,
			Type:       models.FindingUnencryptedResource,
			Severity:   models.SeverityHigh,
			Summary:    fmt.Sprintf("RDS instance '%s' is not encrypted", r.Name),
			Details: map[string]any{
				"resource_id":    r.ResourceID,
				"resource_name":  r.Name,
				"service":        "rds",
				"region":         r.Region,
				"engine":         raw["engine"],
				"recommendation": "Enable encryption for RDS. Note: Encryption must be enabled at creation time. Create an encrypted snapshot and restore to a new encrypted instance.",
				"doc_url":        "https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/Overview.Encryption.html",
			},
			Status: models.FindingStatusOpen,
		}}
	}

	return nil
}

// checkS3PublicAccess checks if an S3 bucket has public access.
func (a *SecurityAnalyzer) checkS3PublicAccess(r *models.Resource) []*models.Finding {
	var raw map[string]any
	if err := json.Unmarshal(r.Raw, &raw); err != nil {
		return nil
	}

	// Check block public access settings
	publicAccessBlock, ok := raw["public_access_block"].(map[string]any)
	if !ok {
		return nil
	}

	// If any of these are false, the bucket may be publicly accessible
	blockPublicAcls := getBoolValue(publicAccessBlock, "block_public_acls")
	ignorePublicAcls := getBoolValue(publicAccessBlock, "ignore_public_acls")
	blockPublicPolicy := getBoolValue(publicAccessBlock, "block_public_policy")
	restrictPublicBuckets := getBoolValue(publicAccessBlock, "restrict_public_buckets")

	if !blockPublicAcls || !ignorePublicAcls || !blockPublicPolicy || !restrictPublicBuckets {
		resourceID := r.ID
		return []*models.Finding{{
			ID:         uuid.New().String(),
			ResourceID: &resourceID,
			Type:       models.FindingPublicAccess,
			Severity:   models.SeverityHigh,
			Summary:    fmt.Sprintf("S3 bucket '%s' may allow public access", r.Name),
			Details: map[string]any{
				"resource_id":             r.ResourceID,
				"bucket_name":             r.Name,
				"service":                 "s3",
				"region":                  r.Region,
				"block_public_acls":       blockPublicAcls,
				"ignore_public_acls":      ignorePublicAcls,
				"block_public_policy":     blockPublicPolicy,
				"restrict_public_buckets": restrictPublicBuckets,
				"recommendation":          "Enable all Block Public Access settings unless public access is explicitly required.",
				"doc_url":                 "https://docs.aws.amazon.com/AmazonS3/latest/userguide/access-control-block-public-access.html",
			},
			Status: models.FindingStatusOpen,
		}}
	}

	return nil
}

// checkSecurityGroup checks for overly permissive security group rules.
func (a *SecurityAnalyzer) checkSecurityGroup(r *models.Resource) []*models.Finding {
	var raw map[string]any
	if err := json.Unmarshal(r.Raw, &raw); err != nil {
		return nil
	}

	var findings []*models.Finding

	ingressRules, ok := raw["ingress_rules"].([]any)
	if !ok {
		return nil
	}

	for _, rule := range ingressRules {
		ruleMap, ok := rule.(map[string]any)
		if !ok {
			continue
		}

		protocol := getStringValue(ruleMap, "protocol")
		fromPort := getInt32Value(ruleMap, "from_port")
		toPort := getInt32Value(ruleMap, "to_port")
		cidrBlocks := getStringSlice(ruleMap, "cidr_blocks")
		ipv6Blocks := getStringSlice(ruleMap, "ipv6_blocks")

		// Check if open to the world
		openToWorld := false
		for _, cidr := range cidrBlocks {
			if cidr == "0.0.0.0/0" {
				openToWorld = true
				break
			}
		}
		for _, cidr := range ipv6Blocks {
			if cidr == "::/0" {
				openToWorld = true
				break
			}
		}

		if !openToWorld {
			continue
		}

		// Check for all ports open
		if protocol == "-1" || (fromPort == 0 && toPort == 65535) {
			resourceID := r.ID
			findings = append(findings, &models.Finding{
				ID:         uuid.New().String(),
				ResourceID: &resourceID,
				Type:       models.FindingOpenAllPorts,
				Severity:   models.SeverityHigh,
				Summary:    fmt.Sprintf("Security group '%s' allows all ports from the internet", r.Name),
				Details: map[string]any{
					"resource_id":    r.ResourceID,
					"group_name":     r.Name,
					"service":        "security_group",
					"region":         r.Region,
					"protocol":       protocol,
					"cidr_blocks":    cidrBlocks,
					"recommendation": "Restrict inbound rules to only the specific ports and IP ranges required.",
					"doc_url":        "https://docs.aws.amazon.com/vpc/latest/userguide/security-group-rules.html",
				},
				Status: models.FindingStatusOpen,
			})
			continue
		}

		// Check for sensitive ports
		for port, service := range sensitivePorts {
			if fromPort <= port && port <= toPort {
				resourceID := r.ID
				findings = append(findings, &models.Finding{
					ID:         uuid.New().String(),
					ResourceID: &resourceID,
					Type:       models.FindingPermissiveSG,
					Severity:   models.SeverityHigh,
					Summary:    fmt.Sprintf("Security group '%s' allows %s (port %d) from the internet", r.Name, service, port),
					Details: map[string]any{
						"resource_id":     r.ResourceID,
						"group_name":      r.Name,
						"service":         "security_group",
						"region":          r.Region,
						"exposed_port":    port,
						"exposed_service": service,
						"from_port":       fromPort,
						"to_port":         toPort,
						"protocol":        protocol,
						"cidr_blocks":     cidrBlocks,
						"recommendation":  fmt.Sprintf("Restrict %s access to specific IP ranges or use a VPN/bastion host.", service),
						"doc_url":         "https://docs.aws.amazon.com/vpc/latest/userguide/security-group-rules.html",
					},
					Status: models.FindingStatusOpen,
				})
			}
		}
	}

	return findings
}

// Helper functions for parsing JSON values
func getBoolValue(m map[string]any, key string) bool {
	if v, ok := m[key].(bool); ok {
		return v
	}
	return false
}

func getStringValue(m map[string]any, key string) string {
	if v, ok := m[key].(string); ok {
		return v
	}
	return ""
}

func getInt32Value(m map[string]any, key string) int32 {
	if v, ok := m[key].(float64); ok {
		return int32(v)
	}
	return 0
}

func getStringSlice(m map[string]any, key string) []string {
	if v, ok := m[key].([]any); ok {
		result := make([]string, 0, len(v))
		for _, item := range v {
			if s, ok := item.(string); ok {
				result = append(result, s)
			}
		}
		return result
	}
	return nil
}
