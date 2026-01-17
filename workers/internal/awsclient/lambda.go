package awsclient

import (
	"context"
	"encoding/json"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/lambda"
	"github.com/maxbolgarin/scanorbit/internal/models"
	"github.com/maxbolgarin/scanorbit/internal/pricing"
	"github.com/rs/zerolog"
)

// LambdaScanner scans AWS Lambda functions.
type LambdaScanner struct {
	logger zerolog.Logger
}

// NewLambdaScanner creates a new LambdaScanner.
func NewLambdaScanner(logger zerolog.Logger) *LambdaScanner {
	return &LambdaScanner{
		logger: logger.With().Str("scanner", "lambda").Logger(),
	}
}

// ScanFunctions retrieves all Lambda functions in a region.
func (s *LambdaScanner) ScanFunctions(ctx context.Context, cfg aws.Config, region string) ([]*models.Resource, error) {
	client := lambda.NewFromConfig(cfg, func(o *lambda.Options) {
		o.Region = region
	})

	var resources []*models.Resource
	paginator := lambda.NewListFunctionsPaginator(client, &lambda.ListFunctionsInput{})

	for paginator.HasMorePages() {
		output, err := paginator.NextPage(ctx)
		if err != nil {
			return nil, err
		}

		for _, fn := range output.Functions {
			r := models.NewResource(aws.ToString(fn.FunctionArn), models.ServiceLambda, region)
			r.Name = aws.ToString(fn.FunctionName)
			r.State = string(fn.State)

			// Get tags for function
			tagsOutput, err := client.ListTags(ctx, &lambda.ListTagsInput{
				Resource: fn.FunctionArn,
			})
			if err == nil && tagsOutput.Tags != nil {
				r.Tags = tagsOutput.Tags
			}

			// Build VPC config struct for JSON
			var vpcConfig map[string]any
			if fn.VpcConfig != nil {
				vpcConfig = map[string]any{
					"VpcId":            aws.ToString(fn.VpcConfig.VpcId),
					"SubnetIds":        fn.VpcConfig.SubnetIds,
					"SecurityGroupIds": fn.VpcConfig.SecurityGroupIds,
				}
			}

			// Build layers array for JSON
			var layers []map[string]any
			for _, layer := range fn.Layers {
				layers = append(layers, map[string]any{
					"Arn":      aws.ToString(layer.Arn),
					"CodeSize": layer.CodeSize,
				})
			}

			// Store function details in raw (including dependency-related fields)
			raw, _ := json.Marshal(map[string]any{
				"function_name":      aws.ToString(fn.FunctionName),
				"function_arn":       aws.ToString(fn.FunctionArn),
				"runtime":            string(fn.Runtime),
				"handler":            aws.ToString(fn.Handler),
				"code_size":          fn.CodeSize,
				"memory_size":        aws.ToInt32(fn.MemorySize),
				"timeout":            aws.ToInt32(fn.Timeout),
				"last_modified":      aws.ToString(fn.LastModified),
				"description":        aws.ToString(fn.Description),
				"architectures":      fn.Architectures,
				"package_type":       string(fn.PackageType),
				"ephemeral_storage":  fn.EphemeralStorage,
				// Dependency-related fields
				"Role":       aws.ToString(fn.Role),
				"VpcConfig":  vpcConfig,
				"Layers":     layers,
				"KMSKeyArn":  aws.ToString(fn.KMSKeyArn),
			})
			r.Raw = raw

			// Calculate Lambda cost based on memory size
			r.CostEstimateMonthly = pricing.LambdaEstimateCost(int(aws.ToInt32(fn.MemorySize)))

			resources = append(resources, r)
		}
	}

	s.logger.Debug().
		Str("region", region).
		Int("functions", len(resources)).
		Msg("scanned Lambda functions")

	return resources, nil
}
