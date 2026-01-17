CREATE TABLE "finding_scans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"finding_id" uuid NOT NULL,
	"scan_id" uuid NOT NULL,
	"status" varchar(20) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "findings" ADD COLUMN "first_detected_at" timestamp;--> statement-breakpoint
ALTER TABLE "findings" ADD COLUMN "last_detected_at" timestamp;--> statement-breakpoint
ALTER TABLE "findings" ADD COLUMN "detection_count" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "findings" ADD COLUMN "last_scan_id" uuid;--> statement-breakpoint
-- Backfill existing findings with lifecycle data
UPDATE "findings" SET
  "first_detected_at" = "created_at",
  "last_detected_at" = COALESCE("updated_at", "created_at")
WHERE "first_detected_at" IS NULL;--> statement-breakpoint
ALTER TABLE "finding_scans" ADD CONSTRAINT "finding_scans_finding_id_findings_id_fk" FOREIGN KEY ("finding_id") REFERENCES "public"."findings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finding_scans" ADD CONSTRAINT "finding_scans_scan_id_scans_id_fk" FOREIGN KEY ("scan_id") REFERENCES "public"."scans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "finding_scans_finding_scan_idx" ON "finding_scans" USING btree ("finding_id","scan_id");--> statement-breakpoint
CREATE INDEX "finding_scans_scan_id_idx" ON "finding_scans" USING btree ("scan_id");--> statement-breakpoint
CREATE INDEX "finding_scans_finding_id_idx" ON "finding_scans" USING btree ("finding_id");--> statement-breakpoint
ALTER TABLE "findings" ADD CONSTRAINT "findings_last_scan_id_scans_id_fk" FOREIGN KEY ("last_scan_id") REFERENCES "public"."scans"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "findings_last_scan_id_idx" ON "findings" USING btree ("last_scan_id");