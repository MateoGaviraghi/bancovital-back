ALTER TABLE "patient" ALTER COLUMN "birth_date" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "order" ADD COLUMN "pdf_report_rendered_at" timestamp with time zone;