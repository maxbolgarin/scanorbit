package awsclient

import (
	"context"
	"encoding/json"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/kms"
	"github.com/aws/aws-sdk-go-v2/service/kms/types"
	"github.com/maxbolgarin/scanorbit/internal/models"
	"github.com/maxbolgarin/scanorbit/internal/pricing"
	"github.com/rs/zerolog"
)

// KMSScanner scans AWS KMS keys.
type KMSScanner struct {
	logger zerolog.Logger
}

// NewKMSScanner creates a new KMSScanner.
func NewKMSScanner(logger zerolog.Logger) *KMSScanner {
	return &KMSScanner{
		logger: logger.With().Str("scanner", "kms").Logger(),
	}
}

// ScanKeys retrieves all KMS keys in a region.
func (s *KMSScanner) ScanKeys(ctx context.Context, cfg aws.Config, region string) ([]*models.Resource, error) {
	client := kms.NewFromConfig(cfg, func(o *kms.Options) {
		o.Region = region
	})

	var resources []*models.Resource
	paginator := kms.NewListKeysPaginator(client, &kms.ListKeysInput{})

	for paginator.HasMorePages() {
		output, err := paginator.NextPage(ctx)
		if err != nil {
			return nil, err
		}

		for _, key := range output.Keys {
			keyID := aws.ToString(key.KeyId)
			keyArn := aws.ToString(key.KeyArn)

			// Get key details
			descOutput, err := client.DescribeKey(ctx, &kms.DescribeKeyInput{
				KeyId: key.KeyId,
			})
			if err != nil {
				s.logger.Warn().Err(err).Str("key_id", keyID).Msg("failed to describe key")
				continue
			}

			keyMeta := descOutput.KeyMetadata

			// Skip AWS managed keys
			if keyMeta.KeyManager == types.KeyManagerTypeAws {
				continue
			}

			r := models.NewResource(keyArn, models.ServiceKMSKey, region)
			r.Name = aws.ToString(keyMeta.Description)
			if r.Name == "" {
				r.Name = keyID
			}
			r.State = string(keyMeta.KeyState)

			// Get tags for key
			tagsOutput, err := client.ListResourceTags(ctx, &kms.ListResourceTagsInput{
				KeyId: key.KeyId,
			})
			if err == nil && tagsOutput.Tags != nil {
				tags := make(map[string]string)
				for _, tag := range tagsOutput.Tags {
					tags[aws.ToString(tag.TagKey)] = aws.ToString(tag.TagValue)
				}
				r.Tags = tags
			}

			// Store key details in raw
			rawData := map[string]any{
				"key_id":        keyID,
				"key_arn":       keyArn,
				"description":   aws.ToString(keyMeta.Description),
				"key_state":     string(keyMeta.KeyState),
				"key_usage":     string(keyMeta.KeyUsage),
				"key_spec":      string(keyMeta.KeySpec),
				"origin":        string(keyMeta.Origin),
				"key_manager":   string(keyMeta.KeyManager),
				"creation_date": keyMeta.CreationDate,
				"enabled":       keyMeta.Enabled,
				"multi_region":  aws.ToBool(keyMeta.MultiRegion),
			}

			// Check rotation status
			rotationOutput, err := client.GetKeyRotationStatus(ctx, &kms.GetKeyRotationStatusInput{
				KeyId: key.KeyId,
			})
			if err == nil {
				rawData["key_rotation_enabled"] = rotationOutput.KeyRotationEnabled
			}

			if keyMeta.DeletionDate != nil {
				rawData["deletion_date"] = keyMeta.DeletionDate
			}
			if keyMeta.ValidTo != nil {
				rawData["valid_to"] = keyMeta.ValidTo
			}

			raw, _ := json.Marshal(rawData)
			r.Raw = raw

			// KMS customer managed keys have a monthly cost
			r.CostEstimateMonthly = pricing.KMSKeyPerMonth

			resources = append(resources, r)
		}
	}

	s.logger.Debug().
		Str("region", region).
		Int("keys", len(resources)).
		Msg("scanned KMS keys")

	return resources, nil
}
