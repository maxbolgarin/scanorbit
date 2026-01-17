CREATE TABLE "resource_scans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"resource_id" uuid NOT NULL,
	"scan_id" uuid NOT NULL,
	"status" varchar(20) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "resource_scans" ADD CONSTRAINT "resource_scans_resource_id_resources_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."resources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_scans" ADD CONSTRAINT "resource_scans_scan_id_scans_id_fk" FOREIGN KEY ("scan_id") REFERENCES "public"."scans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "resource_scans_resource_scan_idx" ON "resource_scans" USING btree ("resource_id","scan_id");--> statement-breakpoint
CREATE INDEX "resource_scans_scan_id_idx" ON "resource_scans" USING btree ("scan_id");--> statement-breakpoint
CREATE INDEX "resource_scans_resource_id_idx" ON "resource_scans" USING btree ("resource_id");