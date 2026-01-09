ALTER TABLE "scans" ADD COLUMN "resources_delta" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "scans" ADD COLUMN "findings_new" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "scans" ADD COLUMN "findings_resolved" integer DEFAULT 0 NOT NULL;