CREATE TABLE "api_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" varchar(500),
	"key_hash" varchar(64) NOT NULL,
	"key_prefix" varchar(12) NOT NULL,
	"created_by" uuid,
	"last_used_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "api_keys_key_hash_unique" UNIQUE("key_hash")
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"timestamp" timestamp DEFAULT now() NOT NULL,
	"user_id" uuid,
	"action" varchar(50) NOT NULL,
	"method" varchar(10),
	"path" varchar(500),
	"status_code" integer,
	"ip_address" varchar(45),
	"user_agent" text,
	"duration_ms" integer
);
--> statement-breakpoint
CREATE TABLE "aws_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"aws_account_id" varchar(12) NOT NULL,
	"role_arn" varchar(255) NOT NULL,
	"external_id" varchar(255),
	"status" varchar(50) DEFAULT 'pending' NOT NULL,
	"last_error" text,
	"last_scan_at" timestamp,
	"enabled_scanners" jsonb DEFAULT '["ec2","rds","s3","alb","acm","lambda","cloudwatch","iam","security_groups","secrets_manager","kms"]'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bug_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text NOT NULL,
	"category" varchar(50) NOT NULL,
	"status" varchar(50) DEFAULT 'open' NOT NULL,
	"screenshot_url" varchar(500),
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "certificates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"aws_account_id" uuid NOT NULL,
	"identifier" varchar(255) NOT NULL,
	"source" varchar(50) NOT NULL,
	"primary_domain" varchar(255),
	"alt_names" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"not_before" timestamp,
	"not_after" timestamp,
	"issuer" varchar(255),
	"algorithm" varchar(50),
	"last_seen_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "consent_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"email" varchar(255) NOT NULL,
	"consent_type" varchar(50) NOT NULL,
	"consent_version" varchar(50) NOT NULL,
	"consent_given" boolean NOT NULL,
	"ip_address" varchar(45),
	"user_agent" text,
	"consented_at" timestamp DEFAULT now() NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "data_deletion_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"email" varchar(255) NOT NULL,
	"request_type" varchar(50) NOT NULL,
	"status" varchar(50) DEFAULT 'pending' NOT NULL,
	"reason" text,
	"requested_at" timestamp DEFAULT now() NOT NULL,
	"processed_at" timestamp,
	"scheduled_deletion_at" timestamp,
	"ip_address" varchar(45),
	"user_agent" text,
	"processed_by" uuid,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "dead_letter_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid,
	"job_type" varchar(50) NOT NULL,
	"payload" jsonb NOT NULL,
	"error" text NOT NULL,
	"retries" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "drip_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subscriber_email" varchar(255) NOT NULL,
	"sequence_name" varchar(100) NOT NULL,
	"email_day" integer NOT NULL,
	"sent_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_subscribers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"name" varchar(255),
	"list" varchar(100) NOT NULL,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"attributes" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "finding_scans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"finding_id" uuid NOT NULL,
	"scan_id" uuid NOT NULL,
	"status" varchar(20) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "findings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"aws_account_id" uuid NOT NULL,
	"resource_id" uuid,
	"certificate_id" uuid,
	"type" varchar(50) NOT NULL,
	"severity" varchar(50) NOT NULL,
	"summary" text NOT NULL,
	"details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" varchar(50) DEFAULT 'open' NOT NULL,
	"resolved_at" timestamp,
	"snoozed_until" timestamp,
	"first_detected_at" timestamp,
	"last_detected_at" timestamp,
	"detection_count" integer DEFAULT 1 NOT NULL,
	"last_scan_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scan_id" uuid,
	"type" varchar(50) NOT NULL,
	"payload" jsonb NOT NULL,
	"status" varchar(50) DEFAULT 'queued' NOT NULL,
	"result" jsonb,
	"error" text,
	"recovery_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"started_at" timestamp,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "org_invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"email" varchar(255) NOT NULL,
	"role" varchar(50) DEFAULT 'member' NOT NULL,
	"invited_by" uuid,
	"token" varchar(255) NOT NULL,
	"status" varchar(50) DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "org_invitations_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "org_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"required_tags" jsonb DEFAULT '["Environment","Owner","CostCenter"]'::jsonb NOT NULL,
	"hidden_finding_types" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"hide_trivial" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "org_settings_org_id_unique" UNIQUE("org_id")
);
--> statement-breakpoint
CREATE TABLE "orgs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"slug" varchar(255) NOT NULL,
	"logo_url" varchar(255),
	"tier" varchar(20) DEFAULT 'free' NOT NULL,
	"tier_upgraded_at" timestamp,
	"stripe_customer_id" varchar(255),
	"stripe_subscription_id" varchar(255),
	"subscription_status" varchar(50) DEFAULT 'none',
	"trial_ends_at" timestamp,
	"subscription_ends_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "orgs_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "resource_dependencies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"source_resource_id" uuid NOT NULL,
	"target_resource_id" varchar(512) NOT NULL,
	"target_service" varchar(50) NOT NULL,
	"relationship_type" varchar(50) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "resource_scans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"resource_id" uuid NOT NULL,
	"scan_id" uuid NOT NULL,
	"status" varchar(20) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "resources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"aws_account_id" uuid NOT NULL,
	"resource_id" varchar(255) NOT NULL,
	"service" varchar(50) NOT NULL,
	"region" varchar(50),
	"name" varchar(255),
	"state" varchar(50),
	"tags" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"cost_estimate_monthly" numeric(10, 2),
	"last_seen_at" timestamp DEFAULT now() NOT NULL,
	"raw" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "retention_policies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid,
	"data_type" varchar(50) NOT NULL,
	"retention_days" integer DEFAULT 365 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"aws_account_id" uuid,
	"status" varchar(50) DEFAULT 'queued' NOT NULL,
	"has_key" boolean DEFAULT true NOT NULL,
	"started_at" timestamp,
	"completed_at" timestamp,
	"resources_discovered" integer DEFAULT 0 NOT NULL,
	"resources_delta" integer DEFAULT 0 NOT NULL,
	"findings_new" integer DEFAULT 0 NOT NULL,
	"findings_resolved" integer DEFAULT 0 NOT NULL,
	"error_message" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_oauth_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"provider" varchar(50) NOT NULL,
	"provider_user_id" varchar(255) NOT NULL,
	"provider_email" varchar(255),
	"access_token" text,
	"refresh_token" text,
	"token_expires_at" timestamp,
	"raw_profile" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_org_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"org_id" uuid NOT NULL,
	"role" varchar(50) DEFAULT 'member' NOT NULL,
	"title" varchar(50),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"password_hash" varchar(255),
	"full_name" varchar(255),
	"email_verified" boolean DEFAULT false NOT NULL,
	"email_verification_code" varchar(6),
	"email_verification_expires_at" timestamp,
	"two_factor_enabled" boolean DEFAULT false NOT NULL,
	"two_factor_secret" varchar(255),
	"two_factor_recovery_codes" text,
	"processing_restricted" boolean DEFAULT false NOT NULL,
	"processing_restricted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aws_accounts" ADD CONSTRAINT "aws_accounts_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bug_reports" ADD CONSTRAINT "bug_reports_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bug_reports" ADD CONSTRAINT "bug_reports_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_aws_account_id_aws_accounts_id_fk" FOREIGN KEY ("aws_account_id") REFERENCES "public"."aws_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consent_logs" ADD CONSTRAINT "consent_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "data_deletion_requests" ADD CONSTRAINT "data_deletion_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "data_deletion_requests" ADD CONSTRAINT "data_deletion_requests_processed_by_users_id_fk" FOREIGN KEY ("processed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dead_letter_jobs" ADD CONSTRAINT "dead_letter_jobs_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finding_scans" ADD CONSTRAINT "finding_scans_finding_id_findings_id_fk" FOREIGN KEY ("finding_id") REFERENCES "public"."findings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finding_scans" ADD CONSTRAINT "finding_scans_scan_id_scans_id_fk" FOREIGN KEY ("scan_id") REFERENCES "public"."scans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "findings" ADD CONSTRAINT "findings_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "findings" ADD CONSTRAINT "findings_aws_account_id_aws_accounts_id_fk" FOREIGN KEY ("aws_account_id") REFERENCES "public"."aws_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "findings" ADD CONSTRAINT "findings_resource_id_resources_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."resources"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "findings" ADD CONSTRAINT "findings_certificate_id_certificates_id_fk" FOREIGN KEY ("certificate_id") REFERENCES "public"."certificates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "findings" ADD CONSTRAINT "findings_last_scan_id_scans_id_fk" FOREIGN KEY ("last_scan_id") REFERENCES "public"."scans"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_scan_id_scans_id_fk" FOREIGN KEY ("scan_id") REFERENCES "public"."scans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_invitations" ADD CONSTRAINT "org_invitations_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_invitations" ADD CONSTRAINT "org_invitations_invited_by_users_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_settings" ADD CONSTRAINT "org_settings_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_dependencies" ADD CONSTRAINT "resource_dependencies_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_dependencies" ADD CONSTRAINT "resource_dependencies_source_resource_id_resources_id_fk" FOREIGN KEY ("source_resource_id") REFERENCES "public"."resources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_scans" ADD CONSTRAINT "resource_scans_resource_id_resources_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."resources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_scans" ADD CONSTRAINT "resource_scans_scan_id_scans_id_fk" FOREIGN KEY ("scan_id") REFERENCES "public"."scans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resources" ADD CONSTRAINT "resources_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resources" ADD CONSTRAINT "resources_aws_account_id_aws_accounts_id_fk" FOREIGN KEY ("aws_account_id") REFERENCES "public"."aws_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "retention_policies" ADD CONSTRAINT "retention_policies_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scans" ADD CONSTRAINT "scans_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scans" ADD CONSTRAINT "scans_aws_account_id_aws_accounts_id_fk" FOREIGN KEY ("aws_account_id") REFERENCES "public"."aws_accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_oauth_accounts" ADD CONSTRAINT "user_oauth_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_org_members" ADD CONSTRAINT "user_org_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_org_members" ADD CONSTRAINT "user_org_members_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "api_keys_org_id_idx" ON "api_keys" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "api_keys_key_hash_idx" ON "api_keys" USING btree ("key_hash");--> statement-breakpoint
CREATE INDEX "audit_logs_timestamp_idx" ON "audit_logs" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX "audit_logs_user_id_idx" ON "audit_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "audit_logs_action_idx" ON "audit_logs" USING btree ("action");--> statement-breakpoint
CREATE UNIQUE INDEX "aws_accounts_org_account_idx" ON "aws_accounts" USING btree ("org_id","aws_account_id");--> statement-breakpoint
CREATE INDEX "aws_accounts_org_id_idx" ON "aws_accounts" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "bug_reports_org_id_idx" ON "bug_reports" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "bug_reports_user_id_idx" ON "bug_reports" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "bug_reports_status_idx" ON "bug_reports" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "certificates_org_account_identifier_idx" ON "certificates" USING btree ("org_id","aws_account_id","identifier");--> statement-breakpoint
CREATE INDEX "certificates_org_id_idx" ON "certificates" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "consent_logs_user_id_idx" ON "consent_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "consent_logs_email_idx" ON "consent_logs" USING btree ("email");--> statement-breakpoint
CREATE INDEX "consent_logs_consent_type_idx" ON "consent_logs" USING btree ("consent_type");--> statement-breakpoint
CREATE INDEX "consent_logs_consented_at_idx" ON "consent_logs" USING btree ("consented_at");--> statement-breakpoint
CREATE INDEX "data_deletion_requests_user_id_idx" ON "data_deletion_requests" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "data_deletion_requests_status_idx" ON "data_deletion_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "data_deletion_requests_requested_at_idx" ON "data_deletion_requests" USING btree ("requested_at");--> statement-breakpoint
CREATE INDEX "dead_letter_jobs_job_type_idx" ON "dead_letter_jobs" USING btree ("job_type");--> statement-breakpoint
CREATE INDEX "dead_letter_jobs_created_at_idx" ON "dead_letter_jobs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "dead_letter_jobs_job_id_idx" ON "dead_letter_jobs" USING btree ("job_id");--> statement-breakpoint
CREATE UNIQUE INDEX "drip_log_email_seq_day_idx" ON "drip_log" USING btree ("subscriber_email","sequence_name","email_day");--> statement-breakpoint
CREATE INDEX "drip_log_subscriber_email_idx" ON "drip_log" USING btree ("subscriber_email");--> statement-breakpoint
CREATE UNIQUE INDEX "email_subscribers_email_list_idx" ON "email_subscribers" USING btree ("email","list");--> statement-breakpoint
CREATE INDEX "email_subscribers_list_status_idx" ON "email_subscribers" USING btree ("list","status");--> statement-breakpoint
CREATE INDEX "email_subscribers_email_idx" ON "email_subscribers" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "finding_scans_finding_scan_idx" ON "finding_scans" USING btree ("finding_id","scan_id");--> statement-breakpoint
CREATE INDEX "finding_scans_scan_id_idx" ON "finding_scans" USING btree ("scan_id");--> statement-breakpoint
CREATE INDEX "finding_scans_finding_id_idx" ON "finding_scans" USING btree ("finding_id");--> statement-breakpoint
CREATE INDEX "findings_org_id_idx" ON "findings" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "findings_org_status_idx" ON "findings" USING btree ("org_id","status");--> statement-breakpoint
CREATE INDEX "findings_type_idx" ON "findings" USING btree ("type");--> statement-breakpoint
CREATE INDEX "findings_severity_idx" ON "findings" USING btree ("severity");--> statement-breakpoint
CREATE INDEX "findings_status_idx" ON "findings" USING btree ("status");--> statement-breakpoint
CREATE INDEX "findings_last_scan_id_idx" ON "findings" USING btree ("last_scan_id");--> statement-breakpoint
CREATE INDEX "jobs_status_idx" ON "jobs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "jobs_type_idx" ON "jobs" USING btree ("type");--> statement-breakpoint
CREATE INDEX "jobs_scan_id_idx" ON "jobs" USING btree ("scan_id");--> statement-breakpoint
CREATE INDEX "jobs_recovery_count_idx" ON "jobs" USING btree ("recovery_count");--> statement-breakpoint
CREATE UNIQUE INDEX "org_invitations_org_email_pending_idx" ON "org_invitations" USING btree ("org_id","email") WHERE status = 'pending';--> statement-breakpoint
CREATE INDEX "org_invitations_org_id_idx" ON "org_invitations" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "orgs_tier_idx" ON "orgs" USING btree ("tier");--> statement-breakpoint
CREATE INDEX "orgs_stripe_customer_id_idx" ON "orgs" USING btree ("stripe_customer_id");--> statement-breakpoint
CREATE INDEX "orgs_subscription_status_idx" ON "orgs" USING btree ("subscription_status");--> statement-breakpoint
CREATE UNIQUE INDEX "resource_dependencies_unique_idx" ON "resource_dependencies" USING btree ("org_id","source_resource_id","target_resource_id","relationship_type");--> statement-breakpoint
CREATE INDEX "resource_dependencies_org_id_idx" ON "resource_dependencies" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "resource_dependencies_source_resource_id_idx" ON "resource_dependencies" USING btree ("source_resource_id");--> statement-breakpoint
CREATE INDEX "resource_dependencies_target_resource_id_idx" ON "resource_dependencies" USING btree ("target_resource_id");--> statement-breakpoint
CREATE INDEX "resource_dependencies_relationship_type_idx" ON "resource_dependencies" USING btree ("relationship_type");--> statement-breakpoint
CREATE UNIQUE INDEX "resource_scans_resource_scan_idx" ON "resource_scans" USING btree ("resource_id","scan_id");--> statement-breakpoint
CREATE INDEX "resource_scans_scan_id_idx" ON "resource_scans" USING btree ("scan_id");--> statement-breakpoint
CREATE INDEX "resource_scans_resource_id_idx" ON "resource_scans" USING btree ("resource_id");--> statement-breakpoint
CREATE UNIQUE INDEX "resources_org_account_resource_idx" ON "resources" USING btree ("org_id","aws_account_id","resource_id");--> statement-breakpoint
CREATE INDEX "resources_org_id_idx" ON "resources" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "resources_aws_account_id_idx" ON "resources" USING btree ("aws_account_id");--> statement-breakpoint
CREATE INDEX "resources_service_idx" ON "resources" USING btree ("service");--> statement-breakpoint
CREATE UNIQUE INDEX "retention_policies_org_data_type_idx" ON "retention_policies" USING btree ("org_id","data_type");--> statement-breakpoint
CREATE INDEX "scans_org_id_idx" ON "scans" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "scans_org_status_idx" ON "scans" USING btree ("org_id","status");--> statement-breakpoint
CREATE INDEX "scans_aws_account_id_idx" ON "scans" USING btree ("aws_account_id");--> statement-breakpoint
CREATE INDEX "scans_has_key_idx" ON "scans" USING btree ("has_key");--> statement-breakpoint
CREATE UNIQUE INDEX "user_oauth_accounts_provider_user_idx" ON "user_oauth_accounts" USING btree ("provider","provider_user_id");--> statement-breakpoint
CREATE INDEX "user_oauth_accounts_user_id_idx" ON "user_oauth_accounts" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "user_org_members_user_org_idx" ON "user_org_members" USING btree ("user_id","org_id");--> statement-breakpoint
CREATE INDEX "user_org_members_user_id_idx" ON "user_org_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_org_members_org_id_idx" ON "user_org_members" USING btree ("org_id");