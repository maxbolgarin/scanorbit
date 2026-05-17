package awsclient

import (
	"context"
	"encoding/json"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/ec2"
	"github.com/maxbolgarin/scanorbit/internal/models"
	"github.com/rs/zerolog"
)

// SecurityGroupScanner scans VPC security groups.
type SecurityGroupScanner struct {
	logger zerolog.Logger
}

// NewSecurityGroupScanner creates a new SecurityGroupScanner.
func NewSecurityGroupScanner(logger zerolog.Logger) *SecurityGroupScanner {
	return &SecurityGroupScanner{
		logger: logger.With().Str("scanner", "security_groups").Logger(),
	}
}

// IngressRule represents an inbound security group rule.
type IngressRule struct {
	Protocol   string   `json:"protocol"`
	FromPort   int32    `json:"from_port"`
	ToPort     int32    `json:"to_port"`
	CIDRBlocks []string `json:"cidr_blocks,omitempty"`
	IPv6Blocks []string `json:"ipv6_blocks,omitempty"`
	SGIDs      []string `json:"security_group_ids,omitempty"`
}

// EgressRule represents an outbound security group rule.
type EgressRule struct {
	Protocol   string   `json:"protocol"`
	FromPort   int32    `json:"from_port"`
	ToPort     int32    `json:"to_port"`
	CIDRBlocks []string `json:"cidr_blocks,omitempty"`
	IPv6Blocks []string `json:"ipv6_blocks,omitempty"`
	SGIDs      []string `json:"security_group_ids,omitempty"`
}

// ScanSecurityGroups retrieves all security groups in a region.
func (s *SecurityGroupScanner) ScanSecurityGroups(ctx context.Context, cfg aws.Config, region string) ([]*models.Resource, error) {
	client := ec2.NewFromConfig(cfg, func(o *ec2.Options) {
		o.Region = region
	})

	var resources []*models.Resource
	paginator := ec2.NewDescribeSecurityGroupsPaginator(client, &ec2.DescribeSecurityGroupsInput{})

	for paginator.HasMorePages() {
		output, err := paginator.NextPage(ctx)
		if err != nil {
			return nil, err
		}

		for _, sg := range output.SecurityGroups {
			sgID := aws.ToString(sg.GroupId)
			r := models.NewResource(sgID, models.ServiceSecurityGroup, region)
			r.Name = aws.ToString(sg.GroupName)

			// Extract tags
			for _, tag := range sg.Tags {
				r.Tags[aws.ToString(tag.Key)] = aws.ToString(tag.Value)
			}

			// Parse ingress rules
			var ingressRules []IngressRule
			for _, rule := range sg.IpPermissions {
				ir := IngressRule{
					Protocol: aws.ToString(rule.IpProtocol),
					FromPort: aws.ToInt32(rule.FromPort),
					ToPort:   aws.ToInt32(rule.ToPort),
				}
				for _, cidr := range rule.IpRanges {
					ir.CIDRBlocks = append(ir.CIDRBlocks, aws.ToString(cidr.CidrIp))
				}
				for _, ipv6 := range rule.Ipv6Ranges {
					ir.IPv6Blocks = append(ir.IPv6Blocks, aws.ToString(ipv6.CidrIpv6))
				}
				for _, userIDGroup := range rule.UserIdGroupPairs {
					ir.SGIDs = append(ir.SGIDs, aws.ToString(userIDGroup.GroupId))
				}
				ingressRules = append(ingressRules, ir)
			}

			// Parse egress rules
			var egressRules []EgressRule
			for _, rule := range sg.IpPermissionsEgress {
				er := EgressRule{
					Protocol: aws.ToString(rule.IpProtocol),
					FromPort: aws.ToInt32(rule.FromPort),
					ToPort:   aws.ToInt32(rule.ToPort),
				}
				for _, cidr := range rule.IpRanges {
					er.CIDRBlocks = append(er.CIDRBlocks, aws.ToString(cidr.CidrIp))
				}
				for _, ipv6 := range rule.Ipv6Ranges {
					er.IPv6Blocks = append(er.IPv6Blocks, aws.ToString(ipv6.CidrIpv6))
				}
				for _, userIDGroup := range rule.UserIdGroupPairs {
					er.SGIDs = append(er.SGIDs, aws.ToString(userIDGroup.GroupId))
				}
				egressRules = append(egressRules, er)
			}

			// Store SG details in raw
			raw, _ := json.Marshal(map[string]any{
				"group_id":      sgID,
				"group_name":    aws.ToString(sg.GroupName),
				"description":   aws.ToString(sg.Description),
				"vpc_id":        aws.ToString(sg.VpcId),
				"owner_id":      aws.ToString(sg.OwnerId),
				"ingress_rules": ingressRules,
				"egress_rules":  egressRules,
			})
			r.Raw = raw

			resources = append(resources, r)
		}
	}

	s.logger.Debug().
		Str("region", region).
		Int("security_groups", len(resources)).
		Msg("scanned security groups")

	return resources, nil
}
