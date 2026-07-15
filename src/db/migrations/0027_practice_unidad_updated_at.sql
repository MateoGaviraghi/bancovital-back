-- Agrega updated_at a practice_unidad para detectar cambios en rangos/referencias
-- y regenerar PDFs automáticamente cuando cambian.
ALTER TABLE "practice_unidad"
  ADD COLUMN IF NOT EXISTS "updated_at" timestamptz NOT NULL DEFAULT now();

-- Inicializar con created_at en filas existentes
UPDATE "practice_unidad" SET "updated_at" = "created_at";
