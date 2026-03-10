ALTER TABLE "users" ADD COLUMN "processing_restricted" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "processing_restricted_at" timestamp;
