-- Add subscription tier fields to orgs table
ALTER TABLE orgs
ADD COLUMN tier VARCHAR(20) NOT NULL DEFAULT 'free',
ADD COLUMN tier_upgraded_at TIMESTAMP;

-- Add index for tier queries
CREATE INDEX orgs_tier_idx ON orgs(tier);
