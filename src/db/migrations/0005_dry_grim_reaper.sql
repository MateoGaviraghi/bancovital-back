ALTER TABLE "practice" ADD COLUMN "parent_id" bigint;--> statement-breakpoint
ALTER TABLE "practice" ADD COLUMN "reference_value" text;--> statement-breakpoint
ALTER TABLE "practice" ADD COLUMN "methodology" text;--> statement-breakpoint
ALTER TABLE "practice" ADD COLUMN "is_elaborated" boolean DEFAULT false NOT NULL;