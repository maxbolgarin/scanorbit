CREATE TABLE "consent_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"email" varchar(255) NOT NULL,
	"consent_type" varchar(50) NOT NULL,
	"consent_version" varchar(50) NOT NULL,
	"consent_given" boolean NOT NULL,
	"ip_address" varchar(45),
	"user_agent" text,
	"consented_at" timestamp DEFAULT now() NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
ALTER TABLE "consent_logs" ADD CONSTRAINT "consent_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "consent_logs_user_id_idx" ON "consent_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "consent_logs_email_idx" ON "consent_logs" USING btree ("email");--> statement-breakpoint
CREATE INDEX "consent_logs_consent_type_idx" ON "consent_logs" USING btree ("consent_type");--> statement-breakpoint
CREATE INDEX "consent_logs_consented_at_idx" ON "consent_logs" USING btree ("consented_at");