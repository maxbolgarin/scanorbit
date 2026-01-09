package awsclient

import (
	"context"
	"encoding/json"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/cloudwatch"
	cwtypes "github.com/aws/aws-sdk-go-v2/service/cloudwatch/types"
	"github.com/aws/aws-sdk-go-v2/service/cloudwatchlogs"
	"github.com/maxbolgarin/scanorbit/internal/models"
	"github.com/rs/zerolog"
)

// CloudWatchScanner scans CloudWatch log groups and alarms.
type CloudWatchScanner struct {
	logger zerolog.Logger
}

// NewCloudWatchScanner creates a new CloudWatchScanner.
func NewCloudWatchScanner(logger zerolog.Logger) *CloudWatchScanner {
	return &CloudWatchScanner{
		logger: logger.With().Str("scanner", "cloudwatch").Logger(),
	}
}

// ScanLogGroups retrieves all CloudWatch log groups in a region.
func (s *CloudWatchScanner) ScanLogGroups(ctx context.Context, cfg aws.Config, region string) ([]*models.Resource, error) {
	client := cloudwatchlogs.NewFromConfig(cfg, func(o *cloudwatchlogs.Options) {
		o.Region = region
	})

	var resources []*models.Resource
	paginator := cloudwatchlogs.NewDescribeLogGroupsPaginator(client, &cloudwatchlogs.DescribeLogGroupsInput{})

	for paginator.HasMorePages() {
		output, err := paginator.NextPage(ctx)
		if err != nil {
			return nil, err
		}

		for _, lg := range output.LogGroups {
			arn := aws.ToString(lg.Arn)
			r := models.NewResource(arn, models.ServiceCloudWatchLogs, region)
			r.Name = aws.ToString(lg.LogGroupName)

			// Get tags for log group
			tagsOutput, err := client.ListTagsForResource(ctx, &cloudwatchlogs.ListTagsForResourceInput{
				ResourceArn: lg.Arn,
			})
			if err == nil && tagsOutput.Tags != nil {
				r.Tags = tagsOutput.Tags
			}

			// Store log group details in raw
			raw, _ := json.Marshal(map[string]any{
				"log_group_name":    aws.ToString(lg.LogGroupName),
				"arn":               arn,
				"creation_time":     lg.CreationTime,
				"retention_days":    lg.RetentionInDays,
				"stored_bytes":      lg.StoredBytes,
				"metric_filter_count": lg.MetricFilterCount,
				"kms_key_id":        aws.ToString(lg.KmsKeyId),
				"data_protection":   lg.DataProtectionStatus,
			})
			r.Raw = raw

			resources = append(resources, r)
		}
	}

	s.logger.Debug().
		Str("region", region).
		Int("log_groups", len(resources)).
		Msg("scanned CloudWatch log groups")

	return resources, nil
}

// ScanAlarms retrieves all CloudWatch alarms in a region.
func (s *CloudWatchScanner) ScanAlarms(ctx context.Context, cfg aws.Config, region string) ([]*models.Resource, error) {
	client := cloudwatch.NewFromConfig(cfg, func(o *cloudwatch.Options) {
		o.Region = region
	})

	var resources []*models.Resource
	paginator := cloudwatch.NewDescribeAlarmsPaginator(client, &cloudwatch.DescribeAlarmsInput{
		AlarmTypes: []cwtypes.AlarmType{cwtypes.AlarmTypeMetricAlarm},
	})

	for paginator.HasMorePages() {
		output, err := paginator.NextPage(ctx)
		if err != nil {
			return nil, err
		}

		for _, alarm := range output.MetricAlarms {
			arn := aws.ToString(alarm.AlarmArn)
			r := models.NewResource(arn, models.ServiceCloudWatchAlarm, region)
			r.Name = aws.ToString(alarm.AlarmName)
			r.State = string(alarm.StateValue)

			// Get tags for alarm
			tagsOutput, err := client.ListTagsForResource(ctx, &cloudwatch.ListTagsForResourceInput{
				ResourceARN: alarm.AlarmArn,
			})
			if err == nil && tagsOutput.Tags != nil {
				tags := make(map[string]string)
				for _, tag := range tagsOutput.Tags {
					tags[aws.ToString(tag.Key)] = aws.ToString(tag.Value)
				}
				r.Tags = tags
			}

			// Store alarm details in raw
			raw, _ := json.Marshal(map[string]any{
				"alarm_name":          aws.ToString(alarm.AlarmName),
				"alarm_arn":           arn,
				"alarm_description":   aws.ToString(alarm.AlarmDescription),
				"state_value":         string(alarm.StateValue),
				"state_reason":        aws.ToString(alarm.StateReason),
				"metric_name":         aws.ToString(alarm.MetricName),
				"namespace":           aws.ToString(alarm.Namespace),
				"statistic":           string(alarm.Statistic),
				"period":              aws.ToInt32(alarm.Period),
				"evaluation_periods":  aws.ToInt32(alarm.EvaluationPeriods),
				"threshold":           aws.ToFloat64(alarm.Threshold),
				"comparison_operator": string(alarm.ComparisonOperator),
				"actions_enabled":     aws.ToBool(alarm.ActionsEnabled),
			})
			r.Raw = raw

			resources = append(resources, r)
		}
	}

	s.logger.Debug().
		Str("region", region).
		Int("alarms", len(resources)).
		Msg("scanned CloudWatch alarms")

	return resources, nil
}
