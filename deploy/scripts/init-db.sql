-- =============================================================================
-- ScanOrbit — Unified Database Initialization
-- =============================================================================
-- Creates databases, per-service users, schema, grants, and migration tracking.
-- Run once on a fresh PostgreSQL instance. Idempotent — safe to re-run.
--
-- This file is executed by init-db.sh, which substitutes password placeholders
-- and computes Drizzle migration hashes.
--
-- Usage:
--   ./scripts/init-db.sh          (recommended — handles passwords & hashes)
--
-- Manual (for debugging):
--   docker compose exec -T postgres psql -U scanorbit -d postgres < scripts/init-db.sql
--   (requires manual password substitution first)
-- =============================================================================

\set ON_ERROR_STOP on

-- =============================================================================
-- 1. CREATE DATABASES
-- =============================================================================

SELECT 'Creating databases...' AS status;

-- CREATE DATABASE cannot run inside DO blocks; use \gexec for conditional creation
SELECT 'CREATE DATABASE scanorbit'
  WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'scanorbit') \gexec

SELECT 'CREATE DATABASE umami'
  WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'umami') \gexec

-- =============================================================================
-- 2. CREATE PER-SERVICE USERS
-- =============================================================================
-- Passwords are substituted by init-db.sh before execution.
-- Placeholders: __SO_MIGRATE_PASS__, __SO_API_PASS__, etc.
-- =============================================================================

SELECT 'Creating database users...' AS status;

DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'so_migrate') THEN
    CREATE ROLE so_migrate LOGIN PASSWORD '__SO_MIGRATE_PASS__';
    RAISE NOTICE 'Created user: so_migrate';
  ELSE
    ALTER ROLE so_migrate PASSWORD '__SO_MIGRATE_PASS__';
    RAISE NOTICE 'Updated password: so_migrate';
  END IF;

  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'so_api') THEN
    CREATE ROLE so_api LOGIN PASSWORD '__SO_API_PASS__';
    RAISE NOTICE 'Created user: so_api';
  ELSE
    ALTER ROLE so_api PASSWORD '__SO_API_PASS__';
    RAISE NOTICE 'Updated password: so_api';
  END IF;

  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'so_scanner') THEN
    CREATE ROLE so_scanner LOGIN PASSWORD '__SO_SCANNER_PASS__';
    RAISE NOTICE 'Created user: so_scanner';
  ELSE
    ALTER ROLE so_scanner PASSWORD '__SO_SCANNER_PASS__';
    RAISE NOTICE 'Updated password: so_scanner';
  END IF;

  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'so_analyzer') THEN
    CREATE ROLE so_analyzer LOGIN PASSWORD '__SO_ANALYZER_PASS__';
    RAISE NOTICE 'Created user: so_analyzer';
  ELSE
    ALTER ROLE so_analyzer PASSWORD '__SO_ANALYZER_PASS__';
    RAISE NOTICE 'Updated password: so_analyzer';
  END IF;

  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'so_backup') THEN
    CREATE ROLE so_backup LOGIN PASSWORD '__SO_BACKUP_PASS__';
    RAISE NOTICE 'Created user: so_backup';
  ELSE
    ALTER ROLE so_backup PASSWORD '__SO_BACKUP_PASS__';
    RAISE NOTICE 'Updated password: so_backup';
  END IF;

  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'so_exporter') THEN
    CREATE ROLE so_exporter LOGIN PASSWORD '__SO_EXPORTER_PASS__';
    RAISE NOTICE 'Created user: so_exporter';
  ELSE
    ALTER ROLE so_exporter PASSWORD '__SO_EXPORTER_PASS__';
    RAISE NOTICE 'Updated password: so_exporter';
  END IF;

  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'so_umami') THEN
    CREATE ROLE so_umami LOGIN PASSWORD '__SO_UMAMI_PASS__';
    RAISE NOTICE 'Created user: so_umami';
  ELSE
    ALTER ROLE so_umami PASSWORD '__SO_UMAMI_PASS__';
    RAISE NOTICE 'Updated password: so_umami';
  END IF;

END $$;

-- so_migrate needs CREATEDB for ensureDatabaseExists() in migrate.ts
ALTER ROLE so_migrate CREATEDB;
GRANT CONNECT ON DATABASE postgres TO so_migrate;

-- =============================================================================
-- 3. SCANORBIT SCHEMA (squashed from all migrations)
-- =============================================================================
-- Switch to scanorbit database for schema creation

\connect scanorbit

SELECT 'Creating scanorbit schema...' AS status;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "users" (
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

CREATE TABLE IF NOT EXISTS "orgs" (
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

CREATE TABLE IF NOT EXISTS "user_org_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"org_id" uuid NOT NULL,
	"role" varchar(50) DEFAULT 'member' NOT NULL,
	"title" varchar(50),
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "user_oauth_accounts" (
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

CREATE TABLE IF NOT EXISTS "org_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"required_tags" jsonb DEFAULT '["Environment","Owner","CostCenter"]'::jsonb NOT NULL,
	"hidden_finding_types" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"hide_trivial" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "org_settings_org_id_unique" UNIQUE("org_id")
);

CREATE TABLE IF NOT EXISTS "aws_accounts" (
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

CREATE TABLE IF NOT EXISTS "scans" (
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

CREATE TABLE IF NOT EXISTS "resources" (
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

CREATE TABLE IF NOT EXISTS "resource_scans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"resource_id" uuid NOT NULL,
	"scan_id" uuid NOT NULL,
	"status" varchar(20) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "resource_dependencies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"source_resource_id" uuid NOT NULL,
	"target_resource_id" varchar(512) NOT NULL,
	"target_service" varchar(50) NOT NULL,
	"relationship_type" varchar(50) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "certificates" (
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

CREATE TABLE IF NOT EXISTS "findings" (
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

CREATE TABLE IF NOT EXISTS "finding_scans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"finding_id" uuid NOT NULL,
	"scan_id" uuid NOT NULL,
	"status" varchar(20) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "jobs" (
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

CREATE TABLE IF NOT EXISTS "dead_letter_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid,
	"job_type" varchar(50) NOT NULL,
	"payload" jsonb NOT NULL,
	"error" text NOT NULL,
	"retries" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "consent_logs" (
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

CREATE TABLE IF NOT EXISTS "audit_logs" (
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

-- data_deletion_requests: user_id is nullable (migration 0002)
CREATE TABLE IF NOT EXISTS "data_deletion_requests" (
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

CREATE TABLE IF NOT EXISTS "retention_policies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid,
	"data_type" varchar(50) NOT NULL,
	"retention_days" integer DEFAULT 365 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

-- drip_log (migration 0001)
CREATE TABLE IF NOT EXISTS "drip_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subscriber_email" varchar(255) NOT NULL,
	"sequence_name" varchar(100) NOT NULL,
	"email_day" integer NOT NULL,
	"sent_at" timestamp DEFAULT now() NOT NULL
);

-- org_invitations (migration 0005)
CREATE TABLE IF NOT EXISTS "org_invitations" (
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

-- api_keys (migration 0006)
CREATE TABLE IF NOT EXISTS "api_keys" (
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

-- bug_reports (migration 0007)
CREATE TABLE IF NOT EXISTS "bug_reports" (
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

-- email_subscribers (migration 0008)
CREATE TABLE IF NOT EXISTS "email_subscribers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"name" varchar(255),
	"list" varchar(100) NOT NULL,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"attributes" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

-- ---------------------------------------------------------------------------
-- Foreign Keys (idempotent: drop if exists, then add)
-- ---------------------------------------------------------------------------

DO $$ BEGIN
  ALTER TABLE "audit_logs" DROP CONSTRAINT IF EXISTS "audit_logs_user_id_users_id_fk";
  ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "aws_accounts" DROP CONSTRAINT IF EXISTS "aws_accounts_org_id_orgs_id_fk";
  ALTER TABLE "aws_accounts" ADD CONSTRAINT "aws_accounts_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "certificates" DROP CONSTRAINT IF EXISTS "certificates_org_id_orgs_id_fk";
  ALTER TABLE "certificates" ADD CONSTRAINT "certificates_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "certificates" DROP CONSTRAINT IF EXISTS "certificates_aws_account_id_aws_accounts_id_fk";
  ALTER TABLE "certificates" ADD CONSTRAINT "certificates_aws_account_id_aws_accounts_id_fk" FOREIGN KEY ("aws_account_id") REFERENCES "public"."aws_accounts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "consent_logs" DROP CONSTRAINT IF EXISTS "consent_logs_user_id_users_id_fk";
  ALTER TABLE "consent_logs" ADD CONSTRAINT "consent_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  -- data_deletion_requests: user_id ON DELETE set null (migration 0002 changed from cascade to set null)
  ALTER TABLE "data_deletion_requests" DROP CONSTRAINT IF EXISTS "data_deletion_requests_user_id_users_id_fk";
  ALTER TABLE "data_deletion_requests" ADD CONSTRAINT "data_deletion_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "data_deletion_requests" DROP CONSTRAINT IF EXISTS "data_deletion_requests_processed_by_users_id_fk";
  ALTER TABLE "data_deletion_requests" ADD CONSTRAINT "data_deletion_requests_processed_by_users_id_fk" FOREIGN KEY ("processed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "dead_letter_jobs" DROP CONSTRAINT IF EXISTS "dead_letter_jobs_job_id_jobs_id_fk";
  ALTER TABLE "dead_letter_jobs" ADD CONSTRAINT "dead_letter_jobs_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "finding_scans" DROP CONSTRAINT IF EXISTS "finding_scans_finding_id_findings_id_fk";
  ALTER TABLE "finding_scans" ADD CONSTRAINT "finding_scans_finding_id_findings_id_fk" FOREIGN KEY ("finding_id") REFERENCES "public"."findings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "finding_scans" DROP CONSTRAINT IF EXISTS "finding_scans_scan_id_scans_id_fk";
  ALTER TABLE "finding_scans" ADD CONSTRAINT "finding_scans_scan_id_scans_id_fk" FOREIGN KEY ("scan_id") REFERENCES "public"."scans"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "findings" DROP CONSTRAINT IF EXISTS "findings_org_id_orgs_id_fk";
  ALTER TABLE "findings" ADD CONSTRAINT "findings_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "findings" DROP CONSTRAINT IF EXISTS "findings_aws_account_id_aws_accounts_id_fk";
  ALTER TABLE "findings" ADD CONSTRAINT "findings_aws_account_id_aws_accounts_id_fk" FOREIGN KEY ("aws_account_id") REFERENCES "public"."aws_accounts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "findings" DROP CONSTRAINT IF EXISTS "findings_resource_id_resources_id_fk";
  ALTER TABLE "findings" ADD CONSTRAINT "findings_resource_id_resources_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."resources"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "findings" DROP CONSTRAINT IF EXISTS "findings_certificate_id_certificates_id_fk";
  ALTER TABLE "findings" ADD CONSTRAINT "findings_certificate_id_certificates_id_fk" FOREIGN KEY ("certificate_id") REFERENCES "public"."certificates"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "findings" DROP CONSTRAINT IF EXISTS "findings_last_scan_id_scans_id_fk";
  ALTER TABLE "findings" ADD CONSTRAINT "findings_last_scan_id_scans_id_fk" FOREIGN KEY ("last_scan_id") REFERENCES "public"."scans"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "jobs" DROP CONSTRAINT IF EXISTS "jobs_scan_id_scans_id_fk";
  ALTER TABLE "jobs" ADD CONSTRAINT "jobs_scan_id_scans_id_fk" FOREIGN KEY ("scan_id") REFERENCES "public"."scans"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "org_settings" DROP CONSTRAINT IF EXISTS "org_settings_org_id_orgs_id_fk";
  ALTER TABLE "org_settings" ADD CONSTRAINT "org_settings_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "resource_dependencies" DROP CONSTRAINT IF EXISTS "resource_dependencies_org_id_orgs_id_fk";
  ALTER TABLE "resource_dependencies" ADD CONSTRAINT "resource_dependencies_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "resource_dependencies" DROP CONSTRAINT IF EXISTS "resource_dependencies_source_resource_id_resources_id_fk";
  ALTER TABLE "resource_dependencies" ADD CONSTRAINT "resource_dependencies_source_resource_id_resources_id_fk" FOREIGN KEY ("source_resource_id") REFERENCES "public"."resources"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "resource_scans" DROP CONSTRAINT IF EXISTS "resource_scans_resource_id_resources_id_fk";
  ALTER TABLE "resource_scans" ADD CONSTRAINT "resource_scans_resource_id_resources_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."resources"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "resource_scans" DROP CONSTRAINT IF EXISTS "resource_scans_scan_id_scans_id_fk";
  ALTER TABLE "resource_scans" ADD CONSTRAINT "resource_scans_scan_id_scans_id_fk" FOREIGN KEY ("scan_id") REFERENCES "public"."scans"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "resources" DROP CONSTRAINT IF EXISTS "resources_org_id_orgs_id_fk";
  ALTER TABLE "resources" ADD CONSTRAINT "resources_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "resources" DROP CONSTRAINT IF EXISTS "resources_aws_account_id_aws_accounts_id_fk";
  ALTER TABLE "resources" ADD CONSTRAINT "resources_aws_account_id_aws_accounts_id_fk" FOREIGN KEY ("aws_account_id") REFERENCES "public"."aws_accounts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "retention_policies" DROP CONSTRAINT IF EXISTS "retention_policies_org_id_orgs_id_fk";
  ALTER TABLE "retention_policies" ADD CONSTRAINT "retention_policies_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "scans" DROP CONSTRAINT IF EXISTS "scans_org_id_orgs_id_fk";
  ALTER TABLE "scans" ADD CONSTRAINT "scans_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "scans" DROP CONSTRAINT IF EXISTS "scans_aws_account_id_aws_accounts_id_fk";
  ALTER TABLE "scans" ADD CONSTRAINT "scans_aws_account_id_aws_accounts_id_fk" FOREIGN KEY ("aws_account_id") REFERENCES "public"."aws_accounts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "user_oauth_accounts" DROP CONSTRAINT IF EXISTS "user_oauth_accounts_user_id_users_id_fk";
  ALTER TABLE "user_oauth_accounts" ADD CONSTRAINT "user_oauth_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "user_org_members" DROP CONSTRAINT IF EXISTS "user_org_members_user_id_users_id_fk";
  ALTER TABLE "user_org_members" ADD CONSTRAINT "user_org_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "user_org_members" DROP CONSTRAINT IF EXISTS "user_org_members_org_id_orgs_id_fk";
  ALTER TABLE "user_org_members" ADD CONSTRAINT "user_org_members_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;
  -- org_invitations (migration 0005)
  ALTER TABLE "org_invitations" DROP CONSTRAINT IF EXISTS "org_invitations_org_id_orgs_id_fk";
  ALTER TABLE "org_invitations" ADD CONSTRAINT "org_invitations_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "org_invitations" DROP CONSTRAINT IF EXISTS "org_invitations_invited_by_users_id_fk";
  ALTER TABLE "org_invitations" ADD CONSTRAINT "org_invitations_invited_by_users_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  -- api_keys (migration 0006)
  ALTER TABLE "api_keys" DROP CONSTRAINT IF EXISTS "api_keys_org_id_orgs_id_fk";
  ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "api_keys" DROP CONSTRAINT IF EXISTS "api_keys_created_by_users_id_fk";
  ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  -- bug_reports (migration 0007)
  ALTER TABLE "bug_reports" DROP CONSTRAINT IF EXISTS "bug_reports_org_id_orgs_id_fk";
  ALTER TABLE "bug_reports" ADD CONSTRAINT "bug_reports_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "bug_reports" DROP CONSTRAINT IF EXISTS "bug_reports_user_id_users_id_fk";
  ALTER TABLE "bug_reports" ADD CONSTRAINT "bug_reports_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
END $$;

-- ---------------------------------------------------------------------------
-- Indexes (from migrations 0000 + 0002)
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS "audit_logs_timestamp_idx" ON "audit_logs" USING btree ("timestamp");
CREATE INDEX IF NOT EXISTS "audit_logs_user_id_idx" ON "audit_logs" USING btree ("user_id");
CREATE INDEX IF NOT EXISTS "audit_logs_action_idx" ON "audit_logs" USING btree ("action");
CREATE UNIQUE INDEX IF NOT EXISTS "aws_accounts_org_account_idx" ON "aws_accounts" USING btree ("org_id","aws_account_id");
CREATE INDEX IF NOT EXISTS "aws_accounts_org_id_idx" ON "aws_accounts" USING btree ("org_id");
CREATE UNIQUE INDEX IF NOT EXISTS "certificates_org_account_identifier_idx" ON "certificates" USING btree ("org_id","aws_account_id","identifier");
CREATE INDEX IF NOT EXISTS "certificates_org_id_idx" ON "certificates" USING btree ("org_id");
CREATE INDEX IF NOT EXISTS "consent_logs_user_id_idx" ON "consent_logs" USING btree ("user_id");
CREATE INDEX IF NOT EXISTS "consent_logs_email_idx" ON "consent_logs" USING btree ("email");
CREATE INDEX IF NOT EXISTS "consent_logs_consent_type_idx" ON "consent_logs" USING btree ("consent_type");
CREATE INDEX IF NOT EXISTS "consent_logs_consented_at_idx" ON "consent_logs" USING btree ("consented_at");
CREATE INDEX IF NOT EXISTS "data_deletion_requests_user_id_idx" ON "data_deletion_requests" USING btree ("user_id");
CREATE INDEX IF NOT EXISTS "data_deletion_requests_status_idx" ON "data_deletion_requests" USING btree ("status");
CREATE INDEX IF NOT EXISTS "data_deletion_requests_requested_at_idx" ON "data_deletion_requests" USING btree ("requested_at");
CREATE INDEX IF NOT EXISTS "dead_letter_jobs_job_type_idx" ON "dead_letter_jobs" USING btree ("job_type");
CREATE INDEX IF NOT EXISTS "dead_letter_jobs_created_at_idx" ON "dead_letter_jobs" USING btree ("created_at");
CREATE INDEX IF NOT EXISTS "dead_letter_jobs_job_id_idx" ON "dead_letter_jobs" USING btree ("job_id");
CREATE UNIQUE INDEX IF NOT EXISTS "finding_scans_finding_scan_idx" ON "finding_scans" USING btree ("finding_id","scan_id");
CREATE INDEX IF NOT EXISTS "finding_scans_scan_id_idx" ON "finding_scans" USING btree ("scan_id");
CREATE INDEX IF NOT EXISTS "finding_scans_finding_id_idx" ON "finding_scans" USING btree ("finding_id");
CREATE INDEX IF NOT EXISTS "findings_org_id_idx" ON "findings" USING btree ("org_id");
CREATE INDEX IF NOT EXISTS "findings_type_idx" ON "findings" USING btree ("type");
CREATE INDEX IF NOT EXISTS "findings_severity_idx" ON "findings" USING btree ("severity");
CREATE INDEX IF NOT EXISTS "findings_status_idx" ON "findings" USING btree ("status");
CREATE INDEX IF NOT EXISTS "findings_last_scan_id_idx" ON "findings" USING btree ("last_scan_id");
-- Composite indexes (migration 0002)
CREATE INDEX IF NOT EXISTS "findings_org_status_idx" ON "findings" USING btree ("org_id","status");
CREATE INDEX IF NOT EXISTS "scans_org_status_idx" ON "scans" USING btree ("org_id","status");
CREATE INDEX IF NOT EXISTS "jobs_status_idx" ON "jobs" USING btree ("status");
CREATE INDEX IF NOT EXISTS "jobs_type_idx" ON "jobs" USING btree ("type");
CREATE INDEX IF NOT EXISTS "jobs_scan_id_idx" ON "jobs" USING btree ("scan_id");
CREATE INDEX IF NOT EXISTS "jobs_recovery_count_idx" ON "jobs" USING btree ("recovery_count");
CREATE INDEX IF NOT EXISTS "orgs_tier_idx" ON "orgs" USING btree ("tier");
CREATE INDEX IF NOT EXISTS "orgs_stripe_customer_id_idx" ON "orgs" USING btree ("stripe_customer_id");
CREATE INDEX IF NOT EXISTS "orgs_subscription_status_idx" ON "orgs" USING btree ("subscription_status");
CREATE UNIQUE INDEX IF NOT EXISTS "resource_dependencies_unique_idx" ON "resource_dependencies" USING btree ("org_id","source_resource_id","target_resource_id","relationship_type");
CREATE INDEX IF NOT EXISTS "resource_dependencies_org_id_idx" ON "resource_dependencies" USING btree ("org_id");
CREATE INDEX IF NOT EXISTS "resource_dependencies_source_resource_id_idx" ON "resource_dependencies" USING btree ("source_resource_id");
CREATE INDEX IF NOT EXISTS "resource_dependencies_target_resource_id_idx" ON "resource_dependencies" USING btree ("target_resource_id");
CREATE INDEX IF NOT EXISTS "resource_dependencies_relationship_type_idx" ON "resource_dependencies" USING btree ("relationship_type");
CREATE UNIQUE INDEX IF NOT EXISTS "resource_scans_resource_scan_idx" ON "resource_scans" USING btree ("resource_id","scan_id");
CREATE INDEX IF NOT EXISTS "resource_scans_scan_id_idx" ON "resource_scans" USING btree ("scan_id");
CREATE INDEX IF NOT EXISTS "resource_scans_resource_id_idx" ON "resource_scans" USING btree ("resource_id");
CREATE UNIQUE INDEX IF NOT EXISTS "resources_org_account_resource_idx" ON "resources" USING btree ("org_id","aws_account_id","resource_id");
CREATE INDEX IF NOT EXISTS "resources_org_id_idx" ON "resources" USING btree ("org_id");
CREATE INDEX IF NOT EXISTS "resources_aws_account_id_idx" ON "resources" USING btree ("aws_account_id");
CREATE INDEX IF NOT EXISTS "resources_service_idx" ON "resources" USING btree ("service");
CREATE UNIQUE INDEX IF NOT EXISTS "retention_policies_org_data_type_idx" ON "retention_policies" USING btree ("org_id","data_type");
CREATE INDEX IF NOT EXISTS "scans_org_id_idx" ON "scans" USING btree ("org_id");
CREATE INDEX IF NOT EXISTS "scans_aws_account_id_idx" ON "scans" USING btree ("aws_account_id");
CREATE INDEX IF NOT EXISTS "scans_has_key_idx" ON "scans" USING btree ("has_key");
CREATE UNIQUE INDEX IF NOT EXISTS "user_oauth_accounts_provider_user_idx" ON "user_oauth_accounts" USING btree ("provider","provider_user_id");
CREATE INDEX IF NOT EXISTS "user_oauth_accounts_user_id_idx" ON "user_oauth_accounts" USING btree ("user_id");
CREATE UNIQUE INDEX IF NOT EXISTS "user_org_members_user_org_idx" ON "user_org_members" USING btree ("user_id","org_id");
CREATE INDEX IF NOT EXISTS "user_org_members_user_id_idx" ON "user_org_members" USING btree ("user_id");
CREATE INDEX IF NOT EXISTS "user_org_members_org_id_idx" ON "user_org_members" USING btree ("org_id");
-- drip_log indexes (migration 0001)
CREATE UNIQUE INDEX IF NOT EXISTS "drip_log_email_seq_day_idx" ON "drip_log" USING btree ("subscriber_email","sequence_name","email_day");
CREATE INDEX IF NOT EXISTS "drip_log_subscriber_email_idx" ON "drip_log" USING btree ("subscriber_email");
-- org_invitations indexes (migration 0005)
CREATE UNIQUE INDEX IF NOT EXISTS "org_invitations_org_email_pending_idx" ON "org_invitations" USING btree ("org_id","email") WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS "org_invitations_org_id_idx" ON "org_invitations" USING btree ("org_id");
-- api_keys indexes (migration 0006)
CREATE INDEX IF NOT EXISTS "api_keys_org_id_idx" ON "api_keys" USING btree ("org_id");
CREATE INDEX IF NOT EXISTS "api_keys_key_hash_idx" ON "api_keys" USING btree ("key_hash");
-- bug_reports indexes (migration 0007)
CREATE INDEX IF NOT EXISTS "bug_reports_org_id_idx" ON "bug_reports" USING btree ("org_id");
CREATE INDEX IF NOT EXISTS "bug_reports_user_id_idx" ON "bug_reports" USING btree ("user_id");
CREATE INDEX IF NOT EXISTS "bug_reports_status_idx" ON "bug_reports" USING btree ("status");
-- email_subscribers indexes (migration 0008)
CREATE UNIQUE INDEX IF NOT EXISTS "email_subscribers_email_list_idx" ON "email_subscribers" USING btree ("email","list");
CREATE INDEX IF NOT EXISTS "email_subscribers_list_status_idx" ON "email_subscribers" USING btree ("list","status");
CREATE INDEX IF NOT EXISTS "email_subscribers_email_idx" ON "email_subscribers" USING btree ("email");

-- =============================================================================
-- 4. OWNERSHIP & GRANTS (scanorbit database)
-- =============================================================================

SELECT 'Configuring scanorbit database privileges...' AS status;

-- Transfer database ownership to so_migrate (for DDL)
ALTER DATABASE scanorbit OWNER TO so_migrate;

-- Transfer ownership of all existing tables and sequences
DO $$ DECLARE r RECORD; BEGIN
  FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE 'ALTER TABLE public.' || quote_ident(r.tablename) || ' OWNER TO so_migrate';
  END LOOP;
  FOR r IN SELECT sequence_name FROM information_schema.sequences WHERE sequence_schema = 'public' LOOP
    EXECUTE 'ALTER SEQUENCE public.' || quote_ident(r.sequence_name) || ' OWNER TO so_migrate';
  END LOOP;
END $$;

-- Grant schema usage to all app users
GRANT ALL PRIVILEGES ON SCHEMA public TO so_migrate;
GRANT USAGE ON SCHEMA public TO so_api, so_scanner, so_analyzer, so_backup, so_exporter;

-- ---------------------------------------------------------------------------
-- so_api: full DML on all tables
-- ---------------------------------------------------------------------------
GRANT CONNECT ON DATABASE scanorbit TO so_api;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO so_api;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO so_api;

-- Future tables created by so_migrate auto-grant to so_api
ALTER DEFAULT PRIVILEGES FOR ROLE so_migrate IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO so_api;
ALTER DEFAULT PRIVILEGES FOR ROLE so_migrate IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO so_api;

-- ---------------------------------------------------------------------------
-- so_scanner: targeted table access
-- ---------------------------------------------------------------------------
GRANT CONNECT ON DATABASE scanorbit TO so_scanner;

-- Read-only tables
GRANT SELECT ON
  users, orgs, user_org_members, org_settings
  TO so_scanner;

-- Read-write tables
GRANT SELECT, INSERT, UPDATE, DELETE ON
  aws_accounts, scans, resources, findings, resource_scans,
  finding_scans, certificates, jobs, dead_letter_jobs, resource_dependencies
  TO so_scanner;

GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO so_scanner;

ALTER DEFAULT PRIVILEGES FOR ROLE so_migrate IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO so_scanner;

-- ---------------------------------------------------------------------------
-- so_analyzer: targeted table access
-- ---------------------------------------------------------------------------
GRANT CONNECT ON DATABASE scanorbit TO so_analyzer;

-- Read-only tables
GRANT SELECT ON
  scans, resources, users, orgs, user_org_members, org_settings,
  resource_dependencies, certificates
  TO so_analyzer;

-- Read-write tables
GRANT SELECT, INSERT, UPDATE ON
  findings, finding_scans, jobs
  TO so_analyzer;

-- Analyzer needs to update scan status to complete
GRANT UPDATE ON scans TO so_analyzer;

-- Analyzer needs to store failed jobs
GRANT SELECT, INSERT ON dead_letter_jobs TO so_analyzer;

GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO so_analyzer;

ALTER DEFAULT PRIVILEGES FOR ROLE so_migrate IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO so_analyzer;

-- ---------------------------------------------------------------------------
-- so_backup: read-only on all tables and sequences (for pg_dump)
-- ---------------------------------------------------------------------------
GRANT CONNECT ON DATABASE scanorbit TO so_backup;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO so_backup;
GRANT SELECT ON ALL SEQUENCES IN SCHEMA public TO so_backup;

ALTER DEFAULT PRIVILEGES FOR ROLE so_migrate IN SCHEMA public
  GRANT SELECT ON TABLES TO so_backup;
ALTER DEFAULT PRIVILEGES FOR ROLE so_migrate IN SCHEMA public
  GRANT SELECT ON SEQUENCES TO so_backup;

-- ---------------------------------------------------------------------------
-- so_exporter: pg_monitor role (statistics views only)
-- ---------------------------------------------------------------------------
GRANT CONNECT ON DATABASE scanorbit TO so_exporter;
GRANT pg_monitor TO so_exporter;

-- ---------------------------------------------------------------------------
-- Revoke public access (defense in depth)
-- ---------------------------------------------------------------------------
REVOKE ALL ON DATABASE scanorbit FROM PUBLIC;

-- =============================================================================
-- 5. DRIZZLE MIGRATION TRACKING
-- =============================================================================
-- The __drizzle_migrations table is created and populated by migrate.ts.
-- When tables already exist (created by this script) and the tracking table
-- is empty, migrate.ts auto-syncs by hashing migration files and inserting records.

-- =============================================================================
-- 6. UMAMI DATABASE SETUP
-- =============================================================================

\connect postgres

SELECT 'Configuring umami database...' AS status;

ALTER DATABASE umami OWNER TO so_umami;
REVOKE ALL ON DATABASE umami FROM PUBLIC;
GRANT CONNECT ON DATABASE umami TO so_umami;

\connect umami

-- Transfer existing tables (if any) to so_umami
DO $$ DECLARE r RECORD; BEGIN
  FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE 'ALTER TABLE public.' || quote_ident(r.tablename) || ' OWNER TO so_umami';
  END LOOP;
  FOR r IN SELECT sequence_name FROM information_schema.sequences WHERE sequence_schema = 'public' LOOP
    EXECUTE 'ALTER SEQUENCE public.' || quote_ident(r.sequence_name) || ' OWNER TO so_umami';
  END LOOP;
END $$;

GRANT ALL PRIVILEGES ON SCHEMA public TO so_umami;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO so_umami;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO so_umami;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO so_umami;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO so_umami;

-- =============================================================================
-- Done
-- =============================================================================

\connect postgres

SELECT '==============================================' AS status;
SELECT 'Database initialization completed!' AS status;
SELECT '==============================================' AS status;
