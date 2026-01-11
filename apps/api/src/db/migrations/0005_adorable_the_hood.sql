CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"timestamp" timestamp DEFAULT now() NOT NULL,
	"user_id" uuid,
	"org_id" uuid,
	"action" varchar(50) NOT NULL,
	"resource" varchar(100) NOT NULL,
	"resource_id" varchar(255),
	"method" varchar(10),
	"path" varchar(500),
	"status_code" integer,
	"ip_address" varchar(45),
	"user_agent" text,
	"details" jsonb DEFAULT '{}'::jsonb,
	"duration_ms" integer
);
--> statement-breakpoint
CREATE TABLE "data_deletion_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
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
	"job_type" varchar(50) NOT NULL,
	"payload" jsonb NOT NULL,
	"error" text NOT NULL,
	"retries" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
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
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "data_deletion_requests" ADD CONSTRAINT "data_deletion_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "data_deletion_requests" ADD CONSTRAINT "data_deletion_requests_processed_by_users_id_fk" FOREIGN KEY ("processed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "retention_policies" ADD CONSTRAINT "retention_policies_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_logs_timestamp_idx" ON "audit_logs" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX "audit_logs_user_id_idx" ON "audit_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "audit_logs_org_id_idx" ON "audit_logs" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "audit_logs_action_idx" ON "audit_logs" USING btree ("action");--> statement-breakpoint
CREATE INDEX "audit_logs_resource_idx" ON "audit_logs" USING btree ("resource");--> statement-breakpoint
CREATE INDEX "data_deletion_requests_user_id_idx" ON "data_deletion_requests" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "data_deletion_requests_status_idx" ON "data_deletion_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "data_deletion_requests_requested_at_idx" ON "data_deletion_requests" USING btree ("requested_at");--> statement-breakpoint
CREATE INDEX "dead_letter_jobs_job_type_idx" ON "dead_letter_jobs" USING btree ("job_type");--> statement-breakpoint
CREATE INDEX "dead_letter_jobs_created_at_idx" ON "dead_letter_jobs" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "retention_policies_org_data_type_idx" ON "retention_policies" USING btree ("org_id","data_type");