-- Refs de agua y efluentes en order + flags en servicio.
ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "solicitante_agua_id" bigint;
--> statement-breakpoint
ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "muestra_agua_id" bigint;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "order" ADD CONSTRAINT "order_solicitante_agua_id_solicitante_agua_id_fk" FOREIGN KEY ("solicitante_agua_id") REFERENCES "public"."solicitante_agua"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "order" ADD CONSTRAINT "order_muestra_agua_id_muestra_agua_id_fk" FOREIGN KEY ("muestra_agua_id") REFERENCES "public"."muestra_agua"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
ALTER TABLE "servicio" ADD COLUMN IF NOT EXISTS "usa_solicitante_agua" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "servicio" ADD COLUMN IF NOT EXISTS "usa_muestra_agua" boolean DEFAULT false NOT NULL;
