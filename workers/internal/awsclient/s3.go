package awsclient

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/maxbolgarin/scanorbit/internal/models"
	"github.com/rs/zerolog"
)

// S3Scanner scans S3 resources.
type S3Scanner struct {
	logger zerolog.Logger
}

// NewS3Scanner creates a new S3 scanner.
func NewS3Scanner(logger zerolog.Logger) *S3Scanner {
	return &S3Scanner{
		logger: logger.With().Str("scanner", "s3").Logger(),
	}
}

// ScanBuckets scans all S3 buckets (global operation).
func (s *S3Scanner) ScanBuckets(ctx context.Context, cfg aws.Config) ([]*models.Resource, error) {
	svc := s3.NewFromConfig(cfg)

	output, err := svc.ListBuckets(ctx, &s3.ListBucketsInput{})
	if err != nil {
		return nil, fmt.Errorf("list buckets: %w", err)
	}

	var resources []*models.Resource
	for _, bucket := range output.Buckets {
		bucketName := aws.ToString(bucket.Name)

		// Get bucket location (region)
		region := s.getBucketRegion(ctx, svc, bucketName)

		raw, _ := json.Marshal(bucket)

		resource := &models.Resource{
			ResourceID: bucketName,
			Service:    models.ServiceS3,
			Region:     region,
			Name:       bucketName,
			State:      "active",
			Tags:       make(map[string]string), // Tags require separate API call
			Raw:        raw,
		}
		resources = append(resources, resource)
	}

	s.logger.Debug().Int("count", len(resources)).Msg("scanned S3 buckets")
	return resources, nil
}

// getBucketRegion retrieves the region for a bucket.
func (s *S3Scanner) getBucketRegion(ctx context.Context, svc *s3.Client, bucketName string) string {
	locOutput, err := svc.GetBucketLocation(ctx, &s3.GetBucketLocationInput{
		Bucket: aws.String(bucketName),
	})
	if err != nil {
		s.logger.Warn().Err(err).Str("bucket", bucketName).Msg("failed to get bucket location")
		return "us-east-1" // Default
	}

	// Empty LocationConstraint means us-east-1
	if locOutput.LocationConstraint == "" {
		return "us-east-1"
	}

	return string(locOutput.LocationConstraint)
}
