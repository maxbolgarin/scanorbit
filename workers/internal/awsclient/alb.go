package awsclient

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/aws/aws-sdk-go-v2/aws"
	elbv2 "github.com/aws/aws-sdk-go-v2/service/elasticloadbalancingv2"
	elbv2types "github.com/aws/aws-sdk-go-v2/service/elasticloadbalancingv2/types"
	"github.com/maxbolgarin/scanorbit/internal/models"
	"github.com/maxbolgarin/scanorbit/internal/pricing"
	"github.com/rs/zerolog"
)

// ALBScanner scans Application Load Balancer resources.
type ALBScanner struct {
	logger zerolog.Logger
}

// NewALBScanner creates a new ALB scanner.
func NewALBScanner(logger zerolog.Logger) *ALBScanner {
	return &ALBScanner{
		logger: logger.With().Str("scanner", "alb").Logger(),
	}
}

// ALBWithTargetGroups represents an ALB with its target groups for JSON serialization.
type ALBWithTargetGroups struct {
	// Original ALB fields will be embedded via json.RawMessage
	LoadBalancerArn       string            `json:"LoadBalancerArn"`
	LoadBalancerName      string            `json:"LoadBalancerName"`
	Type                  string            `json:"Type"`
	Scheme                string            `json:"Scheme"`
	VpcId                 string            `json:"VpcId"`
	State                 *elbv2types.LoadBalancerState `json:"State"`
	DNSName               string            `json:"DNSName"`
	SecurityGroups        []string          `json:"SecurityGroups"`
	AvailabilityZones     []elbv2types.AvailabilityZone `json:"AvailabilityZones"`
	CreatedTime           *string           `json:"CreatedTime"`
	IpAddressType         string            `json:"IpAddressType"`
	// Extended target group information
	TargetGroups          []TargetGroupInfo `json:"TargetGroups"`
}

// TargetGroupInfo represents a target group with its targets.
type TargetGroupInfo struct {
	TargetGroupArn  string       `json:"TargetGroupArn"`
	TargetGroupName string       `json:"TargetGroupName"`
	TargetType      string       `json:"TargetType"`
	Port            int32        `json:"Port"`
	Protocol        string       `json:"Protocol"`
	VpcId           string       `json:"VpcId"`
	Targets         []TargetInfo `json:"Targets"`
}

// TargetInfo represents a target (EC2 instance, IP, or Lambda).
type TargetInfo struct {
	TargetId    string `json:"TargetId"`
	TargetPort  int32  `json:"TargetPort"`
	HealthState string `json:"HealthState"`
}

// ScanLoadBalancers scans all load balancers in a region.
func (s *ALBScanner) ScanLoadBalancers(ctx context.Context, cfg aws.Config, region string) ([]*models.Resource, error) {
	svc := elbv2.NewFromConfig(cfg, func(o *elbv2.Options) {
		o.Region = region
	})

	var resources []*models.Resource
	paginator := elbv2.NewDescribeLoadBalancersPaginator(svc, &elbv2.DescribeLoadBalancersInput{})

	for paginator.HasMorePages() {
		output, err := paginator.NextPage(ctx)
		if err != nil {
			return nil, fmt.Errorf("describe load balancers: %w", err)
		}

		for _, lb := range output.LoadBalancers {
			// Build ALB with target groups
			albData := ALBWithTargetGroups{
				LoadBalancerArn:   aws.ToString(lb.LoadBalancerArn),
				LoadBalancerName:  aws.ToString(lb.LoadBalancerName),
				Type:              string(lb.Type),
				Scheme:            string(lb.Scheme),
				VpcId:             aws.ToString(lb.VpcId),
				State:             lb.State,
				DNSName:           aws.ToString(lb.DNSName),
				SecurityGroups:    lb.SecurityGroups,
				AvailabilityZones: lb.AvailabilityZones,
				IpAddressType:     string(lb.IpAddressType),
			}
			if lb.CreatedTime != nil {
				t := lb.CreatedTime.Format("2006-01-02T15:04:05Z")
				albData.CreatedTime = &t
			}

			// Fetch target groups for this load balancer
			targetGroups := s.fetchTargetGroups(ctx, svc, aws.ToString(lb.LoadBalancerArn))
			albData.TargetGroups = targetGroups

			raw, _ := json.Marshal(albData)

			// Get state name
			state := "unknown"
			if lb.State != nil {
				state = string(lb.State.Code)
			}

			resource := &models.Resource{
				ResourceID:          aws.ToString(lb.LoadBalancerArn),
				Service:             models.ServiceALB,
				Region:              region,
				Name:                aws.ToString(lb.LoadBalancerName),
				State:               state,
				Tags:                make(map[string]string), // Tags require separate API call
				Raw:                 raw,
				CostEstimateMonthly: pricing.ALBBaseCost,
			}
			resources = append(resources, resource)
		}
	}

	// Fetch tags for all load balancers (if any)
	if len(resources) > 0 {
		s.fetchTags(ctx, svc, resources)
	}

	s.logger.Debug().Str("region", region).Int("count", len(resources)).Msg("scanned load balancers")
	return resources, nil
}

// fetchTargetGroups fetches target groups and their targets for a load balancer.
func (s *ALBScanner) fetchTargetGroups(ctx context.Context, svc *elbv2.Client, lbArn string) []TargetGroupInfo {
	var targetGroups []TargetGroupInfo

	// Get target groups for this load balancer
	tgOutput, err := svc.DescribeTargetGroups(ctx, &elbv2.DescribeTargetGroupsInput{
		LoadBalancerArn: aws.String(lbArn),
	})
	if err != nil {
		s.logger.Warn().Err(err).Str("lb_arn", lbArn).Msg("failed to describe target groups")
		return targetGroups
	}

	for _, tg := range tgOutput.TargetGroups {
		tgInfo := TargetGroupInfo{
			TargetGroupArn:  aws.ToString(tg.TargetGroupArn),
			TargetGroupName: aws.ToString(tg.TargetGroupName),
			TargetType:      string(tg.TargetType),
			Port:            aws.ToInt32(tg.Port),
			Protocol:        string(tg.Protocol),
			VpcId:           aws.ToString(tg.VpcId),
		}

		// Get targets for this target group
		thOutput, err := svc.DescribeTargetHealth(ctx, &elbv2.DescribeTargetHealthInput{
			TargetGroupArn: tg.TargetGroupArn,
		})
		if err != nil {
			s.logger.Warn().Err(err).Str("tg_arn", aws.ToString(tg.TargetGroupArn)).Msg("failed to describe target health")
		} else {
			for _, th := range thOutput.TargetHealthDescriptions {
				if th.Target != nil {
					targetInfo := TargetInfo{
						TargetId:   aws.ToString(th.Target.Id),
						TargetPort: aws.ToInt32(th.Target.Port),
					}
					if th.TargetHealth != nil {
						targetInfo.HealthState = string(th.TargetHealth.State)
					}
					tgInfo.Targets = append(tgInfo.Targets, targetInfo)
				}
			}
		}

		targetGroups = append(targetGroups, tgInfo)
	}

	return targetGroups
}

// fetchTags fetches tags for load balancers.
func (s *ALBScanner) fetchTags(ctx context.Context, svc *elbv2.Client, resources []*models.Resource) {
	// DescribeTags allows up to 20 ARNs at a time
	const batchSize = 20

	for i := 0; i < len(resources); i += batchSize {
		end := i + batchSize
		if end > len(resources) {
			end = len(resources)
		}

		batch := resources[i:end]
		arns := make([]string, len(batch))
		arnToResource := make(map[string]*models.Resource)

		for j, r := range batch {
			arns[j] = r.ResourceID
			arnToResource[r.ResourceID] = r
		}

		output, err := svc.DescribeTags(ctx, &elbv2.DescribeTagsInput{
			ResourceArns: arns,
		})
		if err != nil {
			s.logger.Warn().Err(err).Msg("failed to describe tags for load balancers")
			continue
		}

		for _, desc := range output.TagDescriptions {
			if r, ok := arnToResource[aws.ToString(desc.ResourceArn)]; ok {
				r.Tags = albTagsToMap(desc.Tags)
			}
		}
	}
}

// Helper function for ALB tags
func albTagsToMap(tags []elbv2types.Tag) map[string]string {
	result := make(map[string]string)
	for _, tag := range tags {
		result[aws.ToString(tag.Key)] = aws.ToString(tag.Value)
	}
	return result
}
