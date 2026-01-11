package awsclient

import (
	"context"
	"fmt"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/aws/retry"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials/stscreds"
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
	// Configure retry with exponential backoff for throttling errors
	retryer := retry.NewStandard(func(o *retry.StandardOptions) {
		o.MaxAttempts = 5
		o.MaxBackoff = 30 * time.Second
	})

	cfg, err := config.LoadDefaultConfig(ctx,
		config.WithRetryer(func() aws.Retryer {
			return retryer
		}),
	)
	if err != nil {
		return nil, fmt.Errorf("load aws config: %w", err)
	}

	return &Client{
		baseConfig: cfg,
		logger:     logger.With().Str("component", "aws_client").Logger(),
	}, nil
}

// AssumeRole assumes an IAM role and returns auto-refreshing credentials.
func (c *Client) AssumeRole(ctx context.Context, roleARN, externalID string) (aws.CredentialsProvider, error) {
	stsClient := sts.NewFromConfig(c.baseConfig)

	c.logger.Debug().Str("role_arn", roleARN).Msg("assuming role")

	// Use AssumeRoleProvider which automatically refreshes credentials before expiry
	opts := func(o *stscreds.AssumeRoleOptions) {
		o.RoleSessionName = "scanorbit-scanner"
		if externalID != "" {
			o.ExternalID = aws.String(externalID)
		}
	}

	return stscreds.NewAssumeRoleProvider(stsClient, roleARN, opts), nil
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
