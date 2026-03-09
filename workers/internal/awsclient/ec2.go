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
				"volume_id":         aws.ToString(volume.VolumeId),
				"size":              volume.Size,
				"state":             string(volume.State),
				"volume_type":       string(volume.VolumeType),
				"availability_zone": aws.ToString(volume.AvailabilityZone),
				"encrypted":         volume.Encrypted,
				"iops":              volume.Iops,
				"throughput":        volume.Throughput,
				"create_time":       volume.CreateTime,
				"attachments":       volume.Attachments,
			}

			// Store AWS create_time as RFC3339 string for orphan detection
			// We use AWS creation time as the reference - if volume was created
			// long ago and is still unattached, it's likely orphaned
			if volume.CreateTime != nil {
				rawData["aws_create_time"] = volume.CreateTime.Format(time.RFC3339)
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

	resources := make([]*models.Resource, 0, len(output.Addresses))
	for _, address := range output.Addresses {
		// Determine state based on association
		state := "associated"
		isUnassociated := address.AssociationId == nil && address.InstanceId == nil
		if isUnassociated {
			state = "unassociated"
		}

		// Build raw data with additional metadata for orphan detection
		rawData := map[string]any{
			"allocation_id":        aws.ToString(address.AllocationId),
			"public_ip":            aws.ToString(address.PublicIp),
			"domain":               string(address.Domain),
			"association_id":       address.AssociationId,
			"instance_id":          address.InstanceId,
			"network_interface_id": address.NetworkInterfaceId,
			"private_ip":           address.PrivateIpAddress,
		}

		// Note: AWS doesn't provide an allocation timestamp for EIPs.
		// For orphan detection, we rely on the database CreatedAt field
		// which is set when the resource is first discovered.
		// This means the age is calculated from when we first saw the EIP,
		// not from when it became unassociated. This is acceptable because:
		// 1. If EIP was created unassociated and remains so, it's correctly detected
		// 2. If EIP was associated then unassociated, the conservative approach
		//    is to flag it since it indicates potential cleanup needed

		raw, _ := json.Marshal(rawData)

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

// ScanENIs scans all Elastic Network Interfaces in a region.
func (s *EC2Scanner) ScanENIs(ctx context.Context, cfg aws.Config, region string) ([]*models.Resource, error) {
	svc := ec2.NewFromConfig(cfg, func(o *ec2.Options) {
		o.Region = region
	})

	var resources []*models.Resource
	paginator := ec2.NewDescribeNetworkInterfacesPaginator(svc, &ec2.DescribeNetworkInterfacesInput{})

	for paginator.HasMorePages() {
		output, err := paginator.NextPage(ctx)
		if err != nil {
			return nil, fmt.Errorf("describe network interfaces: %w", err)
		}

		for _, eni := range output.NetworkInterfaces {
			// Determine state
			state := string(eni.Status)
			isUnattached := eni.Attachment == nil || eni.Attachment.Status == types.AttachmentStatusDetached

			// Build raw data with additional metadata
			rawData := map[string]any{
				"network_interface_id": aws.ToString(eni.NetworkInterfaceId),
				"description":          aws.ToString(eni.Description),
				"status":               string(eni.Status),
				"interface_type":       string(eni.InterfaceType),
				"vpc_id":               aws.ToString(eni.VpcId),
				"subnet_id":            aws.ToString(eni.SubnetId),
				"availability_zone":    aws.ToString(eni.AvailabilityZone),
				"private_ip":           aws.ToString(eni.PrivateIpAddress),
				"mac_address":          aws.ToString(eni.MacAddress),
				"requester_id":         aws.ToString(eni.RequesterId),
				"requester_managed":    eni.RequesterManaged,
			}

			// Add attachment info if present
			if eni.Attachment != nil {
				rawData["attachment"] = map[string]any{
					"instance_id":           aws.ToString(eni.Attachment.InstanceId),
					"device_index":          eni.Attachment.DeviceIndex,
					"status":                string(eni.Attachment.Status),
					"delete_on_termination": eni.Attachment.DeleteOnTermination,
				}
			}

			// Add security groups
			if len(eni.Groups) > 0 {
				sgs := make([]map[string]string, 0, len(eni.Groups))
				for _, sg := range eni.Groups {
					sgs = append(sgs, map[string]string{
						"group_id":   aws.ToString(sg.GroupId),
						"group_name": aws.ToString(sg.GroupName),
					})
				}
				rawData["security_groups"] = sgs
			}

			raw, _ := json.Marshal(rawData)

			// Set state to "available" for unattached ENIs
			if isUnattached {
				state = "available"
			}

			resource := &models.Resource{
				ResourceID:          aws.ToString(eni.NetworkInterfaceId),
				Service:             models.ServiceENI,
				Region:              region,
				Name:                aws.ToString(eni.Description),
				State:               state,
				Tags:                tagsToMap(eni.TagSet),
				Raw:                 raw,
				CostEstimateMonthly: 0, // ENIs don't have direct costs, but orphaned ones indicate waste
			}
			resources = append(resources, resource)
		}
	}

	s.logger.Debug().Str("region", region).Int("count", len(resources)).Msg("scanned ENIs")
	return resources, nil
}

// ScanNATGateways scans all NAT Gateways in a region.
func (s *EC2Scanner) ScanNATGateways(ctx context.Context, cfg aws.Config, region string) ([]*models.Resource, error) {
	svc := ec2.NewFromConfig(cfg, func(o *ec2.Options) {
		o.Region = region
	})

	var resources []*models.Resource
	paginator := ec2.NewDescribeNatGatewaysPaginator(svc, &ec2.DescribeNatGatewaysInput{})

	for paginator.HasMorePages() {
		output, err := paginator.NextPage(ctx)
		if err != nil {
			return nil, fmt.Errorf("describe nat gateways: %w", err)
		}

		for _, ngw := range output.NatGateways {
			// Build raw data
			rawData := map[string]any{
				"nat_gateway_id":    aws.ToString(ngw.NatGatewayId),
				"state":             string(ngw.State),
				"connectivity_type": string(ngw.ConnectivityType),
				"vpc_id":            aws.ToString(ngw.VpcId),
				"subnet_id":         aws.ToString(ngw.SubnetId),
				"failure_code":      aws.ToString(ngw.FailureCode),
				"failure_message":   aws.ToString(ngw.FailureMessage),
			}

			// Add creation time
			if ngw.CreateTime != nil {
				rawData["create_time"] = ngw.CreateTime.Format(time.RFC3339)
			}

			// Add NAT Gateway addresses (EIPs associated)
			if len(ngw.NatGatewayAddresses) > 0 {
				addresses := make([]map[string]any, 0, len(ngw.NatGatewayAddresses))
				for _, addr := range ngw.NatGatewayAddresses {
					addresses = append(addresses, map[string]any{
						"public_ip":            aws.ToString(addr.PublicIp),
						"private_ip":           aws.ToString(addr.PrivateIp),
						"allocation_id":        aws.ToString(addr.AllocationId),
						"network_interface_id": aws.ToString(addr.NetworkInterfaceId),
					})
				}
				rawData["addresses"] = addresses
			}

			raw, _ := json.Marshal(rawData)

			// NAT Gateway costs ~$32-45/month (hourly + data processing)
			cost := pricing.NATGatewayBaseCost

			resource := &models.Resource{
				ResourceID:          aws.ToString(ngw.NatGatewayId),
				Service:             models.ServiceNATGateway,
				Region:              region,
				Name:                getTagValue(ngw.Tags, "Name"),
				State:               string(ngw.State),
				Tags:                tagsToMap(ngw.Tags),
				Raw:                 raw,
				CostEstimateMonthly: cost,
			}
			resources = append(resources, resource)
		}
	}

	s.logger.Debug().Str("region", region).Int("count", len(resources)).Msg("scanned NAT Gateways")
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
