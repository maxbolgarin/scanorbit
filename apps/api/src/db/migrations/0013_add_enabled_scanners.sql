-- Add enabled_scanners column to aws_accounts table
-- Default value includes all available scanners for backward compatibility
ALTER TABLE "aws_accounts" ADD COLUMN "enabled_scanners" jsonb DEFAULT '["ec2","rds","s3","alb","acm","lambda","cloudwatch","iam","security_groups","secrets_manager","kms"]'::jsonb NOT NULL;
