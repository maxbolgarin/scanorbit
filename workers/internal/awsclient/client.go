package awsclient

import (
	"context"
	"fmt"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/sts"
	"github.com/rs/zerolog"
)

// Client provides AWS SDK operations.
type Client struct {
	baseConfig aws.Config
	logger     zerolog.Logger
}

// NewClient creates a new AWS client.
func NewClient(ctx context.Context, logger zerolog.Logger) (*Client, error) {
	cfg, err := config.LoadDefaultConfig(ctx)
	if err != nil {
		return nil, fmt.Errorf("load aws config: %w", err)
	}

	return &Client{
		baseConfig: cfg,
		logger:     logger.With().Str("component", "aws_client").Logger(),
	}, nil
}

// AssumeRole assumes an IAM role and returns temporary credentials.
func (c *Client) AssumeRole(ctx context.Context, roleARN, externalID string) (aws.CredentialsProvider, error) {
	stsClient := sts.NewFromConfig(c.baseConfig)

	input := &sts.AssumeRoleInput{
		RoleArn:         aws.String(roleARN),
		RoleSessionName: aws.String("scanorbit-scanner"),
		DurationSeconds: aws.Int32(3600), // 1 hour
	}
	if externalID != "" {
		input.ExternalId = aws.String(externalID)
	}

	c.logger.Debug().Str("role_arn", roleARN).Msg("assuming role")

	result, err := stsClient.AssumeRole(ctx, input)
	if err != nil {
		return nil, fmt.Errorf("assume role: %w", err)
	}

	return credentials.NewStaticCredentialsProvider(
		*result.Credentials.AccessKeyId,
		*result.Credentials.SecretAccessKey,
		*result.Credentials.SessionToken,
	), nil
}

// GetConfigForAccount returns an AWS config with assumed role credentials.
func (c *Client) GetConfigForAccount(ctx context.Context, roleARN, externalID string) (aws.Config, error) {
	creds, err := c.AssumeRole(ctx, roleARN, externalID)
	if err != nil {
		return aws.Config{}, err
	}

	cfg := c.baseConfig.Copy()
	cfg.Credentials = creds

	return cfg, nil
}

// BaseConfig returns the base AWS configuration.
func (c *Client) BaseConfig() aws.Config {
	return c.baseConfig
}
