-- Agrega snapshots de UB a cotizacion_item para trazabilidad histórica de precios,
-- y copago_porc a cotizacion para desglosar cobertura OS / cargo paciente.

ALTER TABLE "cotizacion_item"
  ADD COLUMN "ubs_snapshot" numeric(8, 2),
  ADD COLUMN "ub_value_snapshot" numeric(12, 2);--> statement-breakpoint

ALTER TABLE "cotizacion"
  ADD COLUMN "copago_porc" numeric(5, 2);
