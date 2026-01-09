package awsclient

import (
	"context"
	"encoding/json"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/iam"
	"github.com/maxbolgarin/scanorbit/internal/models"
	"github.com/rs/zerolog"
)

// IAMScanner scans IAM users, roles, and access keys.
type IAMScanner struct {
	logger zerolog.Logger
}

// NewIAMScanner creates a new IAMScanner.
func NewIAMScanner(logger zerolog.Logger) *IAMScanner {
	return &IAMScanner{
		logger: logger.With().Str("scanner", "iam").Logger(),
	}
}

// ScanUsers retrieves all IAM users (global, not region-specific).
func (s *IAMScanner) ScanUsers(ctx context.Context, cfg aws.Config) ([]*models.Resource, error) {
	client := iam.NewFromConfig(cfg)

	var resources []*models.Resource
	paginator := iam.NewListUsersPaginator(client, &iam.ListUsersInput{})

	for paginator.HasMorePages() {
		output, err := paginator.NextPage(ctx)
		if err != nil {
			return nil, err
		}

		for _, user := range output.Users {
			arn := aws.ToString(user.Arn)
			r := models.NewResource(arn, models.ServiceIAMUser, "global")
			r.Name = aws.ToString(user.UserName)

			// Get tags for user
			tagsOutput, err := client.ListUserTags(ctx, &iam.ListUserTagsInput{
				UserName: user.UserName,
			})
			if err == nil && tagsOutput.Tags != nil {
				tags := make(map[string]string)
				for _, tag := range tagsOutput.Tags {
					tags[aws.ToString(tag.Key)] = aws.ToString(tag.Value)
				}
				r.Tags = tags
			}

			// Check MFA devices
			mfaOutput, err := client.ListMFADevices(ctx, &iam.ListMFADevicesInput{
				UserName: user.UserName,
			})
			mfaEnabled := false
			if err == nil && len(mfaOutput.MFADevices) > 0 {
				mfaEnabled = true
			}

			// Store user details in raw
			rawData := map[string]any{
				"user_name":          aws.ToString(user.UserName),
				"user_id":            aws.ToString(user.UserId),
				"arn":                arn,
				"path":               aws.ToString(user.Path),
				"create_date":        user.CreateDate,
				"mfa_enabled":        mfaEnabled,
			}
			if user.PasswordLastUsed != nil {
				rawData["password_last_used"] = user.PasswordLastUsed
			}
			raw, _ := json.Marshal(rawData)
			r.Raw = raw

			resources = append(resources, r)
		}
	}

	s.logger.Debug().
		Int("users", len(resources)).
		Msg("scanned IAM users")

	return resources, nil
}

// ScanRoles retrieves all IAM roles (global, not region-specific).
func (s *IAMScanner) ScanRoles(ctx context.Context, cfg aws.Config) ([]*models.Resource, error) {
	client := iam.NewFromConfig(cfg)

	var resources []*models.Resource
	paginator := iam.NewListRolesPaginator(client, &iam.ListRolesInput{})

	for paginator.HasMorePages() {
		output, err := paginator.NextPage(ctx)
		if err != nil {
			return nil, err
		}

		for _, role := range output.Roles {
			arn := aws.ToString(role.Arn)
			r := models.NewResource(arn, models.ServiceIAMRole, "global")
			r.Name = aws.ToString(role.RoleName)

			// Get tags for role
			tagsOutput, err := client.ListRoleTags(ctx, &iam.ListRoleTagsInput{
				RoleName: role.RoleName,
			})
			if err == nil && tagsOutput.Tags != nil {
				tags := make(map[string]string)
				for _, tag := range tagsOutput.Tags {
					tags[aws.ToString(tag.Key)] = aws.ToString(tag.Value)
				}
				r.Tags = tags
			}

			// Get role last used info
			roleOutput, err := client.GetRole(ctx, &iam.GetRoleInput{
				RoleName: role.RoleName,
			})

			rawData := map[string]any{
				"role_name":           aws.ToString(role.RoleName),
				"role_id":             aws.ToString(role.RoleId),
				"arn":                 arn,
				"path":                aws.ToString(role.Path),
				"create_date":         role.CreateDate,
				"max_session_duration": aws.ToInt32(role.MaxSessionDuration),
				"description":         aws.ToString(role.Description),
			}
			if err == nil && roleOutput.Role != nil && roleOutput.Role.RoleLastUsed != nil {
				if roleOutput.Role.RoleLastUsed.LastUsedDate != nil {
					rawData["last_used_date"] = roleOutput.Role.RoleLastUsed.LastUsedDate
				}
				if roleOutput.Role.RoleLastUsed.Region != nil {
					rawData["last_used_region"] = aws.ToString(roleOutput.Role.RoleLastUsed.Region)
				}
			}
			raw, _ := json.Marshal(rawData)
			r.Raw = raw

			resources = append(resources, r)
		}
	}

	s.logger.Debug().
		Int("roles", len(resources)).
		Msg("scanned IAM roles")

	return resources, nil
}

// ScanAccessKeys retrieves all IAM access keys for all users (global).
func (s *IAMScanner) ScanAccessKeys(ctx context.Context, cfg aws.Config) ([]*models.Resource, error) {
	client := iam.NewFromConfig(cfg)

	// First get all users
	var users []string
	userPaginator := iam.NewListUsersPaginator(client, &iam.ListUsersInput{})
	for userPaginator.HasMorePages() {
		output, err := userPaginator.NextPage(ctx)
		if err != nil {
			return nil, err
		}
		for _, user := range output.Users {
			users = append(users, aws.ToString(user.UserName))
		}
	}

	var resources []*models.Resource

	// Get access keys for each user
	for _, userName := range users {
		keysOutput, err := client.ListAccessKeys(ctx, &iam.ListAccessKeysInput{
			UserName: aws.String(userName),
		})
		if err != nil {
			s.logger.Warn().Err(err).Str("user", userName).Msg("failed to list access keys")
			continue
		}

		for _, key := range keysOutput.AccessKeyMetadata {
			keyID := aws.ToString(key.AccessKeyId)
			r := models.NewResource(keyID, models.ServiceIAMAccessKey, "global")
			r.Name = keyID
			r.State = string(key.Status)

			// Get last used info
			lastUsedOutput, err := client.GetAccessKeyLastUsed(ctx, &iam.GetAccessKeyLastUsedInput{
				AccessKeyId: key.AccessKeyId,
			})

			rawData := map[string]any{
				"access_key_id": keyID,
				"user_name":     userName,
				"status":        string(key.Status),
				"create_date":   key.CreateDate,
			}
			if err == nil && lastUsedOutput.AccessKeyLastUsed != nil {
				if lastUsedOutput.AccessKeyLastUsed.LastUsedDate != nil {
					rawData["last_used_date"] = lastUsedOutput.AccessKeyLastUsed.LastUsedDate
				}
				if lastUsedOutput.AccessKeyLastUsed.ServiceName != nil {
					rawData["last_used_service"] = aws.ToString(lastUsedOutput.AccessKeyLastUsed.ServiceName)
				}
				if lastUsedOutput.AccessKeyLastUsed.Region != nil {
					rawData["last_used_region"] = aws.ToString(lastUsedOutput.AccessKeyLastUsed.Region)
				}
			}
			raw, _ := json.Marshal(rawData)
			r.Raw = raw

			resources = append(resources, r)
		}
	}

	s.logger.Debug().
		Int("access_keys", len(resources)).
		Msg("scanned IAM access keys")

	return resources, nil
}
