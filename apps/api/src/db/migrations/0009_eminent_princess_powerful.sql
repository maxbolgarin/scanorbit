CREATE TABLE "resource_dependencies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"source_resource_id" uuid NOT NULL,
	"target_resource_id" varchar(512) NOT NULL,
	"target_service" varchar(50) NOT NULL,
	"relationship_type" varchar(50) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "resource_dependencies" ADD CONSTRAINT "resource_dependencies_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_dependencies" ADD CONSTRAINT "resource_dependencies_source_resource_id_resources_id_fk" FOREIGN KEY ("source_resource_id") REFERENCES "public"."resources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "resource_dependencies_unique_idx" ON "resource_dependencies" USING btree ("org_id","source_resource_id","target_resource_id","relationship_type");--> statement-breakpoint
CREATE INDEX "resource_dependencies_org_id_idx" ON "resource_dependencies" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "resource_dependencies_source_resource_id_idx" ON "resource_dependencies" USING btree ("source_resource_id");--> statement-breakpoint
CREATE INDEX "resource_dependencies_target_resource_id_idx" ON "resource_dependencies" USING btree ("target_resource_id");--> statement-breakpoint
CREATE INDEX "resource_dependencies_relationship_type_idx" ON "resource_dependencies" USING btree ("relationship_type");