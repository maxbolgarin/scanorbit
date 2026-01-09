package awsclient

import (
	"context"
	"encoding/json"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/secretsmanager"
	"github.com/maxbolgarin/scanorbit/internal/models"
	"github.com/rs/zerolog"
)

// SecretsManagerScanner scans AWS Secrets Manager secrets.
type SecretsManagerScanner struct {
	logger zerolog.Logger
}

// NewSecretsManagerScanner creates a new SecretsManagerScanner.
func NewSecretsManagerScanner(logger zerolog.Logger) *SecretsManagerScanner {
	return &SecretsManagerScanner{
		logger: logger.With().Str("scanner", "secrets_manager").Logger(),
	}
}

// ScanSecrets retrieves all secrets in a region.
func (s *SecretsManagerScanner) ScanSecrets(ctx context.Context, cfg aws.Config, region string) ([]*models.Resource, error) {
	client := secretsmanager.NewFromConfig(cfg, func(o *secretsmanager.Options) {
		o.Region = region
	})

	var resources []*models.Resource
	paginator := secretsmanager.NewListSecretsPaginator(client, &secretsmanager.ListSecretsInput{})

	for paginator.HasMorePages() {
		output, err := paginator.NextPage(ctx)
		if err != nil {
			return nil, err
		}

		for _, secret := range output.SecretList {
			arn := aws.ToString(secret.ARN)
			r := models.NewResource(arn, models.ServiceSecret, region)
			r.Name = aws.ToString(secret.Name)

			// Extract tags
			for _, tag := range secret.Tags {
				r.Tags[aws.ToString(tag.Key)] = aws.ToString(tag.Value)
			}

			// Store secret details in raw
			rawData := map[string]any{
				"name":              aws.ToString(secret.Name),
				"arn":               arn,
				"description":       aws.ToString(secret.Description),
				"kms_key_id":        aws.ToString(secret.KmsKeyId),
				"rotation_enabled":  aws.ToBool(secret.RotationEnabled),
				"created_date":      secret.CreatedDate,
				"primary_region":    aws.ToString(secret.PrimaryRegion),
			}
			if secret.LastAccessedDate != nil {
				rawData["last_accessed_date"] = secret.LastAccessedDate
			}
			if secret.LastChangedDate != nil {
				rawData["last_changed_date"] = secret.LastChangedDate
			}
			if secret.LastRotatedDate != nil {
				rawData["last_rotated_date"] = secret.LastRotatedDate
			}
			if secret.NextRotationDate != nil {
				rawData["next_rotation_date"] = secret.NextRotationDate
			}
			if secret.DeletedDate != nil {
				rawData["deleted_date"] = secret.DeletedDate
			}
			raw, _ := json.Marshal(rawData)
			r.Raw = raw

			resources = append(resources, r)
		}
	}

	s.logger.Debug().
		Str("region", region).
		Int("secrets", len(resources)).
		Msg("scanned secrets")

	return resources, nil
}
