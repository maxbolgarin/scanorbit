-- Add Stripe-related fields to orgs table
ALTER TABLE "orgs" ADD COLUMN "stripe_customer_id" varchar(255);
ALTER TABLE "orgs" ADD COLUMN "stripe_subscription_id" varchar(255);
ALTER TABLE "orgs" ADD COLUMN "subscription_status" varchar(50) DEFAULT 'none';
ALTER TABLE "orgs" ADD COLUMN "trial_ends_at" timestamp;
ALTER TABLE "orgs" ADD COLUMN "subscription_ends_at" timestamp;

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS "orgs_stripe_customer_id_idx" ON "orgs" ("stripe_customer_id");
CREATE INDEX IF NOT EXISTS "orgs_stripe_subscription_id_idx" ON "orgs" ("stripe_subscription_id");
CREATE INDEX IF NOT EXISTS "orgs_subscription_status_idx" ON "orgs" ("subscription_status");
