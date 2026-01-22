-- Add subscription tier fields to orgs table
-- Use IF NOT EXISTS to make migration idempotent
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orgs' AND column_name = 'tier') THEN
    ALTER TABLE orgs ADD COLUMN tier VARCHAR(20) NOT NULL DEFAULT 'free';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orgs' AND column_name = 'tier_upgraded_at') THEN
    ALTER TABLE orgs ADD COLUMN tier_upgraded_at TIMESTAMP;
  END IF;
END $$;

-- Add index for tier queries (IF NOT EXISTS)
CREATE INDEX IF NOT EXISTS orgs_tier_idx ON orgs(tier);
