ALTER TABLE "order" ADD COLUMN "public_report_token" varchar(64);--> statement-breakpoint
ALTER TABLE "order" ADD COLUMN "public_access_attempts" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "order" ADD COLUMN "public_access_locked_until" timestamp with time zone;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_order_public_token" ON "order" USING btree ("public_report_token");