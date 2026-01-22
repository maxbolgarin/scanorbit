-- Add recovery_count column to jobs table for tracking job recovery attempts
-- This prevents infinite recovery loops by limiting how many times a stuck job can be recovered

-- Use IF NOT EXISTS to make migration idempotent
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'jobs' AND column_name = 'recovery_count') THEN
    ALTER TABLE "jobs" ADD COLUMN "recovery_count" integer DEFAULT 0 NOT NULL;
  END IF;
END $$;

-- Create index for efficient querying of jobs that may need recovery
CREATE INDEX IF NOT EXISTS "jobs_recovery_count_idx" ON "jobs" ("recovery_count");

-- Add comment for documentation
COMMENT ON COLUMN "jobs"."recovery_count" IS 'Number of times this job has been recovered from stuck/orphaned state';
