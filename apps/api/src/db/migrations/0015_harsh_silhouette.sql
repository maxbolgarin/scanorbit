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
--> statement-breakpoint
ALTER TABLE "audit_logs" DROP CONSTRAINT IF EXISTS "audit_logs_org_id_orgs_id_fk";
--> statement-breakpoint
DROP INDEX IF EXISTS "audit_logs_org_id_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "audit_logs_resource_idx";--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "password_hash" DROP NOT NULL;--> statement-breakpoint
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'aws_accounts' AND column_name = 'enabled_scanners'
    ) THEN
        ALTER TABLE "aws_accounts" ADD COLUMN "enabled_scanners" jsonb DEFAULT '["ec2","rds","s3","alb","acm","lambda","cloudwatch","iam","security_groups","secrets_manager","kms"]'::jsonb NOT NULL;
    END IF;
END $$;--> statement-breakpoint
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'user_oauth_accounts_user_id_users_id_fk'
    ) THEN
        ALTER TABLE "user_oauth_accounts" ADD CONSTRAINT "user_oauth_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
    END IF;
END $$;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "user_oauth_accounts_provider_user_idx" ON "user_oauth_accounts" USING btree ("provider","provider_user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_oauth_accounts_user_id_idx" ON "user_oauth_accounts" USING btree ("user_id");--> statement-breakpoint
ALTER TABLE "audit_logs" DROP COLUMN IF EXISTS "org_id";--> statement-breakpoint
ALTER TABLE "audit_logs" DROP COLUMN IF EXISTS "resource";--> statement-breakpoint
ALTER TABLE "audit_logs" DROP COLUMN IF EXISTS "resource_id";--> statement-breakpoint
ALTER TABLE "audit_logs" DROP COLUMN IF EXISTS "details";