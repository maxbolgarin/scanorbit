ALTER TABLE "data_deletion_requests" DROP CONSTRAINT "data_deletion_requests_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "data_deletion_requests" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "data_deletion_requests" ADD CONSTRAINT "data_deletion_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "findings_org_status_idx" ON "findings" USING btree ("org_id","status");--> statement-breakpoint
CREATE INDEX "scans_org_status_idx" ON "scans" USING btree ("org_id","status");