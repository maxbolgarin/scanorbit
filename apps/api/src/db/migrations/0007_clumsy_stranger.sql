ALTER TABLE "scans" DROP CONSTRAINT IF EXISTS "scans_aws_account_id_aws_accounts_id_fk";
--> statement-breakpoint
ALTER TABLE "scans" ALTER COLUMN "aws_account_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "scans" ALTER COLUMN "status" SET DEFAULT 'queued';--> statement-breakpoint
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'dead_letter_jobs' 
        AND column_name = 'job_id'
    ) THEN
        ALTER TABLE "dead_letter_jobs" ADD COLUMN "job_id" uuid;
    END IF;
END $$;--> statement-breakpoint
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'scans' 
        AND column_name = 'has_key'
    ) THEN
        ALTER TABLE "scans" ADD COLUMN "has_key" boolean DEFAULT true NOT NULL;
    END IF;
END $$;--> statement-breakpoint
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_schema = 'public' 
        AND constraint_name = 'dead_letter_jobs_job_id_jobs_id_fk'
    ) THEN
        ALTER TABLE "dead_letter_jobs" ADD CONSTRAINT "dead_letter_jobs_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE set null ON UPDATE no action;
    END IF;
END $$;--> statement-breakpoint
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_schema = 'public' 
        AND constraint_name = 'scans_aws_account_id_aws_accounts_id_fk'
    ) THEN
        ALTER TABLE "scans" ADD CONSTRAINT "scans_aws_account_id_aws_accounts_id_fk" FOREIGN KEY ("aws_account_id") REFERENCES "public"."aws_accounts"("id") ON DELETE set null ON UPDATE no action;
    END IF;
END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "dead_letter_jobs_job_id_idx" ON "dead_letter_jobs" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "scans_has_key_idx" ON "scans" USING btree ("has_key");