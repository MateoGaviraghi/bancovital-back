-- Formularios dinámicos: formConfig en servicio, customData en order.
ALTER TABLE "servicio" ADD COLUMN IF NOT EXISTS "form_config" jsonb;
--> statement-breakpoint
ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "custom_data" jsonb;
