package awsclient

import (
	"context"
	"fmt"
	"strings"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/ec2"
)

// ListEnabledRegions returns all enabled regions for the account.
// If EC2 permissions are not available, it falls back to a hardcoded list of all AWS regions.
func (c *Client) ListEnabledRegions(ctx context.Context, cfg aws.Config) ([]string, error) {
	ec2Client := ec2.NewFromConfig(cfg)

	output, err := ec2Client.DescribeRegions(ctx, &ec2.DescribeRegionsInput{
		AllRegions: aws.Bool(false), // Only return enabled regions
	})
	if err != nil {
		// Check if this is a permission error (UnauthorizedOperation or AccessDenied)
		// If so, fall back to hardcoded list of all AWS regions
		if isPermissionError(err) {
			c.logger.Debug().Err(err).Msg("EC2 DescribeRegions permission denied, using hardcoded region list")
			return getAllAWSRegions(), nil
		}
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

// isPermissionError checks if an error is a permission/authorization error.
func isPermissionError(err error) bool {
	if err == nil {
		return false
	}

	errStr := err.Error()
	// Check for common permission error patterns from AWS SDK
	return strings.Contains(errStr, "UnauthorizedOperation") ||
		strings.Contains(errStr, "AccessDenied") ||
		strings.Contains(errStr, "not authorized") ||
		strings.Contains(errStr, "is not authorized to perform") ||
		strings.Contains(errStr, "StatusCode: 403")
}

// getAllAWSRegions returns a hardcoded list of standard AWS regions.
// This is used as a fallback when EC2 DescribeRegions is not available.
// Only includes standard regions that are always available (excludes opt-in regions and GovCloud).
func getAllAWSRegions() []string {
	return []string{
		"us-east-1",      // US East (N. Virginia) - always available
		"us-east-2",      // US East (Ohio) - always available
		"us-west-1",      // US West (N. California) - always available
		"us-west-2",      // US West (Oregon) - always available
		"ap-south-1",     // Asia Pacific (Mumbai) - always available
		"ap-southeast-1", // Asia Pacific (Singapore) - always available
		"ap-southeast-2", // Asia Pacific (Sydney) - always available
		"ap-northeast-1", // Asia Pacific (Tokyo) - always available
		"ap-northeast-2", // Asia Pacific (Seoul) - always available
		"ca-central-1",   // Canada (Central) - always available
		"eu-central-1",   // Europe (Frankfurt) - always available
		"eu-west-1",      // Europe (Ireland) - always available
		"eu-west-2",      // Europe (London) - always available
		"eu-west-3",      // Europe (Paris) - always available
		"eu-north-1",     // Europe (Stockholm) - always available
		"sa-east-1",      // South America (São Paulo) - always available
		// Excluded opt-in regions that require account activation:
		// - af-south-1 (Africa Cape Town)
		// - ap-east-1 (Hong Kong)
		// - ap-south-2 (Hyderabad)
		// - ap-southeast-3 (Jakarta)
		// - ap-southeast-4 (Melbourne)
		// - ap-southeast-5 (Osaka)
		// - ap-northeast-3 (Osaka-Local)
		// - ca-west-1 (Calgary)
		// - eu-central-2 (Zurich)
		// - eu-south-1 (Milan)
		// - eu-south-2 (Spain)
		// - il-central-1 (Tel Aviv)
		// - me-south-1 (Bahrain)
		// - me-central-1 (UAE)
		// Excluded GovCloud regions (require separate account):
		// - us-gov-east-1
		// - us-gov-west-1
	}
}
