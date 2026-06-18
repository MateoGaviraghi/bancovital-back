DROP INDEX "idx_preferencia_pdf_lab";--> statement-breakpoint
ALTER TABLE "preferencia_pdf" ADD COLUMN "nombre" text DEFAULT 'Formato predeterminado' NOT NULL;--> statement-breakpoint
ALTER TABLE "preferencia_pdf" ADD COLUMN "tipo" text DEFAULT 'informe' NOT NULL;--> statement-breakpoint
ALTER TABLE "preferencia_pdf" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "idx_preferencia_pdf_lab_tipo" ON "preferencia_pdf" USING btree ("lab_id","tipo");--> statement-breakpoint
CREATE INDEX "idx_preferencia_pdf_lab" ON "preferencia_pdf" USING btree ("lab_id");