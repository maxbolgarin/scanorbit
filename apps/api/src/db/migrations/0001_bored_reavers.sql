CREATE TABLE "drip_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subscriber_email" varchar(255) NOT NULL,
	"sequence_name" varchar(100) NOT NULL,
	"email_day" integer NOT NULL,
	"sent_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "drip_log_email_seq_day_idx" ON "drip_log" USING btree ("subscriber_email","sequence_name","email_day");--> statement-breakpoint
CREATE INDEX "drip_log_subscriber_email_idx" ON "drip_log" USING btree ("subscriber_email");