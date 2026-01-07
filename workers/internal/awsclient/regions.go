package awsclient

import (
	"context"
	"fmt"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/ec2"
)

// ListEnabledRegions returns all enabled regions for the account.
func (c *Client) ListEnabledRegions(ctx context.Context, cfg aws.Config) ([]string, error) {
	ec2Client := ec2.NewFromConfig(cfg)

	output, err := ec2Client.DescribeRegions(ctx, &ec2.DescribeRegionsInput{
		AllRegions: aws.Bool(false), // Only return enabled regions
	})
	if err != nil {
		return nil, fmt.Errorf("describe regions: %w", err)
	}

	regions := make([]string, 0, len(output.Regions))
	for _, region := range output.Regions {
		if region.RegionName != nil {
			regions = append(regions, *region.RegionName)
		}
	}

	c.logger.Debug().Int("count", len(regions)).Msg("discovered enabled regions")
	return regions, nil
}
