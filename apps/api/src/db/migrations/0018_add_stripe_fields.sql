-- Add Stripe-related fields to orgs table
-- Use IF NOT EXISTS to make migration idempotent
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orgs' AND column_name = 'stripe_customer_id') THEN
    ALTER TABLE "orgs" ADD COLUMN "stripe_customer_id" varchar(255);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orgs' AND column_name = 'stripe_subscription_id') THEN
    ALTER TABLE "orgs" ADD COLUMN "stripe_subscription_id" varchar(255);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orgs' AND column_name = 'subscription_status') THEN
    ALTER TABLE "orgs" ADD COLUMN "subscription_status" varchar(50) DEFAULT 'none';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orgs' AND column_name = 'trial_ends_at') THEN
    ALTER TABLE "orgs" ADD COLUMN "trial_ends_at" timestamp;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orgs' AND column_name = 'subscription_ends_at') THEN
    ALTER TABLE "orgs" ADD COLUMN "subscription_ends_at" timestamp;
  END IF;
END $$;

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS "orgs_stripe_customer_id_idx" ON "orgs" ("stripe_customer_id");
CREATE INDEX IF NOT EXISTS "orgs_stripe_subscription_id_idx" ON "orgs" ("stripe_subscription_id");
CREATE INDEX IF NOT EXISTS "orgs_subscription_status_idx" ON "orgs" ("subscription_status");
