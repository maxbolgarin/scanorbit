package awsclient

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/ec2"
	"github.com/aws/aws-sdk-go-v2/service/ec2/types"
	"github.com/maxbolgarin/scanorbit/internal/models"
	"github.com/maxbolgarin/scanorbit/internal/pricing"
	"github.com/rs/zerolog"
)

// EC2Scanner scans EC2 resources.
type EC2Scanner struct {
	logger zerolog.Logger
}

// NewEC2Scanner creates a new EC2 scanner.
func NewEC2Scanner(logger zerolog.Logger) *EC2Scanner {
	return &EC2Scanner{
		logger: logger.With().Str("scanner", "ec2").Logger(),
	}
}

// ScanInstances scans all EC2 instances in a region.
func (s *EC2Scanner) ScanInstances(ctx context.Context, cfg aws.Config, region string) ([]*models.Resource, error) {
	svc := ec2.NewFromConfig(cfg, func(o *ec2.Options) {
		o.Region = region
	})

	var resources []*models.Resource
	paginator := ec2.NewDescribeInstancesPaginator(svc, &ec2.DescribeInstancesInput{})

	for paginator.HasMorePages() {
		output, err := paginator.NextPage(ctx)
		if err != nil {
			return nil, fmt.Errorf("describe instances: %w", err)
		}

		for _, reservation := range output.Reservations {
			for _, instance := range reservation.Instances {
				raw, _ := json.Marshal(instance)

				// Calculate cost - only running instances incur compute cost
				var cost float64
				if instance.State.Name == types.InstanceStateNameRunning {
					cost = pricing.GetEC2Cost(string(instance.InstanceType))
				}

				resource := &models.Resource{
					ResourceID:          aws.ToString(instance.InstanceId),
					Service:             models.ServiceEC2,
					Region:              region,
					Name:                getTagValue(instance.Tags, "Name"),
					State:               string(instance.State.Name),
					Tags:                tagsToMap(instance.Tags),
					Raw:                 raw,
					CostEstimateMonthly: cost,
				}
				resources = append(resources, resource)
			}
		}
	}

	s.logger.Debug().Str("region", region).Int("count", len(resources)).Msg("scanned EC2 instances")
	return resources, nil
}

// ScanVolumes scans all EBS volumes in a region.
func (s *EC2Scanner) ScanVolumes(ctx context.Context, cfg aws.Config, region string) ([]*models.Resource, error) {
	svc := ec2.NewFromConfig(cfg, func(o *ec2.Options) {
		o.Region = region
	})

	var resources []*models.Resource
	paginator := ec2.NewDescribeVolumesPaginator(svc, &ec2.DescribeVolumesInput{})

	for paginator.HasMorePages() {
		output, err := paginator.NextPage(ctx)
		if err != nil {
			return nil, fmt.Errorf("describe volumes: %w", err)
		}

		for _, volume := range output.Volumes {
			// Determine state: "available" means unattached (potential orphan)
			state := string(volume.State)
			isUnattached := len(volume.Attachments) == 0 && state == "available"
			if isUnattached {
				state = "unattached"
			}

			// Build raw data with additional metadata
			rawData := map[string]any{
				"volume_id":       aws.ToString(volume.VolumeId),
				"size":            volume.Size,
				"state":           string(volume.State),
				"volume_type":     string(volume.VolumeType),
				"availability_zone": aws.ToString(volume.AvailabilityZone),
				"encrypted":       volume.Encrypted,
				"iops":            volume.Iops,
				"throughput":      volume.Throughput,
				"create_time":     volume.CreateTime,
				"attachments":     volume.Attachments,
			}

			// Add unattached_since timestamp for orphan detection
			if isUnattached {
				rawData["unattached_since"] = time.Now().Format(time.RFC3339)
			}

			raw, _ := json.Marshal(rawData)

			// Calculate EBS cost based on volume type and size
			cost := pricing.GetEBSCost(string(volume.VolumeType), int(aws.ToInt32(volume.Size)))

			resource := &models.Resource{
				ResourceID:          aws.ToString(volume.VolumeId),
				Service:             models.ServiceEBS,
				Region:              region,
				Name:                getTagValue(volume.Tags, "Name"),
				State:               state,
				Tags:                tagsToMap(volume.Tags),
				Raw:                 raw,
				CostEstimateMonthly: cost,
			}
			resources = append(resources, resource)
		}
	}

	s.logger.Debug().Str("region", region).Int("count", len(resources)).Msg("scanned EBS volumes")
	return resources, nil
}

// ScanEIPs scans all Elastic IPs in a region.
func (s *EC2Scanner) ScanEIPs(ctx context.Context, cfg aws.Config, region string) ([]*models.Resource, error) {
	svc := ec2.NewFromConfig(cfg, func(o *ec2.Options) {
		o.Region = region
	})

	output, err := svc.DescribeAddresses(ctx, &ec2.DescribeAddressesInput{})
	if err != nil {
		return nil, fmt.Errorf("describe addresses: %w", err)
	}

	var resources []*models.Resource
	for _, address := range output.Addresses {
		raw, _ := json.Marshal(address)

		// Determine state based on association
		state := "associated"
		isUnassociated := address.AssociationId == nil && address.InstanceId == nil
		if isUnassociated {
			state = "unassociated"
		}

		// EIPs cost money when unassociated
		var cost float64
		if isUnassociated {
			cost = pricing.EIPUnattachedCost
		}

		resource := &models.Resource{
			ResourceID:          aws.ToString(address.AllocationId),
			Service:             models.ServiceEIP,
			Region:              region,
			Name:                aws.ToString(address.PublicIp),
			State:               state,
			Tags:                tagsToMap(address.Tags),
			Raw:                 raw,
			CostEstimateMonthly: cost,
		}
		resources = append(resources, resource)
	}

	s.logger.Debug().Str("region", region).Int("count", len(resources)).Msg("scanned EIPs")
	return resources, nil
}

// Helper functions

func getTagValue(tags []types.Tag, key string) string {
	for _, tag := range tags {
		if aws.ToString(tag.Key) == key {
			return aws.ToString(tag.Value)
		}
	}
	return ""
}

func tagsToMap(tags []types.Tag) map[string]string {
	result := make(map[string]string)
	for _, tag := range tags {
		result[aws.ToString(tag.Key)] = aws.ToString(tag.Value)
	}
	return result
}
