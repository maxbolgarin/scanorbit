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
			raw, _ := json.Marshal(lb)

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
