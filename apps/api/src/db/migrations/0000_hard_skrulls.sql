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
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" varchar(50) NOT NULL,
	"payload" jsonb NOT NULL,
	"status" varchar(50) DEFAULT 'queued' NOT NULL,
	"result" jsonb,
	"error" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"started_at" timestamp,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "orgs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"slug" varchar(255) NOT NULL,
	"logo_url" varchar(255),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "orgs_slug_unique" UNIQUE("slug")
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
CREATE TABLE "scans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"aws_account_id" uuid NOT NULL,
	"status" varchar(50) DEFAULT 'pending' NOT NULL,
	"started_at" timestamp,
	"completed_at" timestamp,
	"resources_discovered" integer DEFAULT 0 NOT NULL,
	"error_message" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_org_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"org_id" uuid NOT NULL,
	"role" varchar(50) DEFAULT 'member' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"password_hash" varchar(255) NOT NULL,
	"full_name" varchar(255),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "aws_accounts" ADD CONSTRAINT "aws_accounts_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_aws_account_id_aws_accounts_id_fk" FOREIGN KEY ("aws_account_id") REFERENCES "public"."aws_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "findings" ADD CONSTRAINT "findings_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "findings" ADD CONSTRAINT "findings_aws_account_id_aws_accounts_id_fk" FOREIGN KEY ("aws_account_id") REFERENCES "public"."aws_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "findings" ADD CONSTRAINT "findings_resource_id_resources_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."resources"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "findings" ADD CONSTRAINT "findings_certificate_id_certificates_id_fk" FOREIGN KEY ("certificate_id") REFERENCES "public"."certificates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resources" ADD CONSTRAINT "resources_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resources" ADD CONSTRAINT "resources_aws_account_id_aws_accounts_id_fk" FOREIGN KEY ("aws_account_id") REFERENCES "public"."aws_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scans" ADD CONSTRAINT "scans_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scans" ADD CONSTRAINT "scans_aws_account_id_aws_accounts_id_fk" FOREIGN KEY ("aws_account_id") REFERENCES "public"."aws_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_org_members" ADD CONSTRAINT "user_org_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_org_members" ADD CONSTRAINT "user_org_members_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "aws_accounts_org_account_idx" ON "aws_accounts" USING btree ("org_id","aws_account_id");--> statement-breakpoint
CREATE INDEX "aws_accounts_org_id_idx" ON "aws_accounts" USING btree ("org_id");--> statement-breakpoint
CREATE UNIQUE INDEX "certificates_org_account_identifier_idx" ON "certificates" USING btree ("org_id","aws_account_id","identifier");--> statement-breakpoint
CREATE INDEX "certificates_org_id_idx" ON "certificates" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "findings_org_id_idx" ON "findings" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "findings_type_idx" ON "findings" USING btree ("type");--> statement-breakpoint
CREATE INDEX "findings_severity_idx" ON "findings" USING btree ("severity");--> statement-breakpoint
CREATE INDEX "findings_status_idx" ON "findings" USING btree ("status");--> statement-breakpoint
CREATE INDEX "jobs_status_idx" ON "jobs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "jobs_type_idx" ON "jobs" USING btree ("type");--> statement-breakpoint
CREATE UNIQUE INDEX "resources_org_account_resource_idx" ON "resources" USING btree ("org_id","aws_account_id","resource_id");--> statement-breakpoint
CREATE INDEX "resources_org_id_idx" ON "resources" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "resources_aws_account_id_idx" ON "resources" USING btree ("aws_account_id");--> statement-breakpoint
CREATE INDEX "resources_service_idx" ON "resources" USING btree ("service");--> statement-breakpoint
CREATE INDEX "scans_org_id_idx" ON "scans" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "scans_aws_account_id_idx" ON "scans" USING btree ("aws_account_id");--> statement-breakpoint
CREATE UNIQUE INDEX "user_org_members_user_org_idx" ON "user_org_members" USING btree ("user_id","org_id");--> statement-breakpoint
CREATE INDEX "user_org_members_user_id_idx" ON "user_org_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_org_members_org_id_idx" ON "user_org_members" USING btree ("org_id");