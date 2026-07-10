-- Índices de performance (auditoría 2026-07). Idempotente.
-- Ya aplicados en erqxxx a mano; esta migración los deja en el historial para que
-- una base nueva (dev/branch) los reciba al correr las migraciones.
CREATE INDEX IF NOT EXISTS "idx_practice_parent" ON "practice" ("parent_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_order_practice_practice" ON "order_practice" ("practice_id");
