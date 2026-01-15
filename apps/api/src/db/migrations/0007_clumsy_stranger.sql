ALTER TABLE "scans" DROP CONSTRAINT "scans_aws_account_id_aws_accounts_id_fk";
--> statement-breakpoint
ALTER TABLE "scans" ALTER COLUMN "aws_account_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "scans" ALTER COLUMN "status" SET DEFAULT 'queued';--> statement-breakpoint
ALTER TABLE "dead_letter_jobs" ADD COLUMN "job_id" uuid;--> statement-breakpoint
ALTER TABLE "scans" ADD COLUMN "has_key" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "dead_letter_jobs" ADD CONSTRAINT "dead_letter_jobs_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scans" ADD CONSTRAINT "scans_aws_account_id_aws_accounts_id_fk" FOREIGN KEY ("aws_account_id") REFERENCES "public"."aws_accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "dead_letter_jobs_job_id_idx" ON "dead_letter_jobs" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "scans_has_key_idx" ON "scans" USING btree ("has_key");