package awsclient

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/rds"
	rdstypes "github.com/aws/aws-sdk-go-v2/service/rds/types"
	"github.com/maxbolgarin/scanorbit/internal/models"
	"github.com/rs/zerolog"
)

// RDSScanner scans RDS resources.
type RDSScanner struct {
	logger zerolog.Logger
}

// NewRDSScanner creates a new RDS scanner.
func NewRDSScanner(logger zerolog.Logger) *RDSScanner {
	return &RDSScanner{
		logger: logger.With().Str("scanner", "rds").Logger(),
	}
}

// ScanInstances scans all RDS instances in a region.
func (s *RDSScanner) ScanInstances(ctx context.Context, cfg aws.Config, region string) ([]*models.Resource, error) {
	svc := rds.NewFromConfig(cfg, func(o *rds.Options) {
		o.Region = region
	})

	var resources []*models.Resource
	paginator := rds.NewDescribeDBInstancesPaginator(svc, &rds.DescribeDBInstancesInput{})

	for paginator.HasMorePages() {
		output, err := paginator.NextPage(ctx)
		if err != nil {
			return nil, fmt.Errorf("describe db instances: %w", err)
		}

		for _, instance := range output.DBInstances {
			raw, _ := json.Marshal(instance)

			resource := &models.Resource{
				ResourceID: aws.ToString(instance.DBInstanceIdentifier),
				Service:    models.ServiceRDS,
				Region:     region,
				Name:       aws.ToString(instance.DBInstanceIdentifier),
				State:      aws.ToString(instance.DBInstanceStatus),
				Tags:       rdsTagsToMap(instance.TagList),
				Raw:        raw,
			}
			resources = append(resources, resource)
		}
	}

	s.logger.Debug().Str("region", region).Int("count", len(resources)).Msg("scanned RDS instances")
	return resources, nil
}

// ScanSnapshots scans all manual RDS snapshots in a region.
func (s *RDSScanner) ScanSnapshots(ctx context.Context, cfg aws.Config, region string) ([]*models.Resource, error) {
	svc := rds.NewFromConfig(cfg, func(o *rds.Options) {
		o.Region = region
	})

	var resources []*models.Resource
	paginator := rds.NewDescribeDBSnapshotsPaginator(svc, &rds.DescribeDBSnapshotsInput{
		SnapshotType: aws.String("manual"), // Only manual snapshots (potential orphans)
	})

	for paginator.HasMorePages() {
		output, err := paginator.NextPage(ctx)
		if err != nil {
			return nil, fmt.Errorf("describe db snapshots: %w", err)
		}

		for _, snapshot := range output.DBSnapshots {
			raw, _ := json.Marshal(snapshot)

			resource := &models.Resource{
				ResourceID: aws.ToString(snapshot.DBSnapshotIdentifier),
				Service:    models.ServiceRDSSnapshot,
				Region:     region,
				Name:       aws.ToString(snapshot.DBSnapshotIdentifier),
				State:      aws.ToString(snapshot.Status),
				Tags:       rdsTagsToMap(snapshot.TagList),
				Raw:        raw,
			}
			resources = append(resources, resource)
		}
	}

	s.logger.Debug().Str("region", region).Int("count", len(resources)).Msg("scanned RDS snapshots")
	return resources, nil
}

// Helper function for RDS tags
func rdsTagsToMap(tags []rdstypes.Tag) map[string]string {
	result := make(map[string]string)
	for _, tag := range tags {
		result[aws.ToString(tag.Key)] = aws.ToString(tag.Value)
	}
	return result
}
