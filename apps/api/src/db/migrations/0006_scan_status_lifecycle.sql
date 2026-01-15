-- Migration: Enhanced scan status lifecycle
-- Adds has_key column and changes FK constraint behavior for scans table

-- Step 1: Add has_key column with default true for existing records
ALTER TABLE "scans" ADD COLUMN "has_key" boolean DEFAULT true NOT NULL;

-- Step 2: Drop the existing foreign key constraint
ALTER TABLE "scans" DROP CONSTRAINT "scans_aws_account_id_aws_accounts_id_fk";

-- Step 3: Make aws_account_id nullable
ALTER TABLE "scans" ALTER COLUMN "aws_account_id" DROP NOT NULL;

-- Step 4: Re-add FK constraint with SET NULL behavior
ALTER TABLE "scans" ADD CONSTRAINT "scans_aws_account_id_aws_accounts_id_fk"
  FOREIGN KEY ("aws_account_id") REFERENCES "aws_accounts"("id") ON DELETE SET NULL;

-- Step 5: Add index for has_key column (for filtering archived scans)
CREATE INDEX IF NOT EXISTS "scans_has_key_idx" ON "scans" ("has_key");

-- Step 6: Update default status from 'pending' to 'queued' for new scans
ALTER TABLE "scans" ALTER COLUMN "status" SET DEFAULT 'queued';

-- Step 7: Convert existing 'pending' status to 'queued' for consistency
UPDATE "scans" SET "status" = 'queued' WHERE "status" = 'pending';
