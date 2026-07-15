-- Migración 0026: unidad_medida y practice_unidad pasan a ser globales
-- lab_id queda nullable: NULL = global (compartido por todos los labs)

-- 1. Hacer lab_id nullable en unidad_medida
ALTER TABLE "unidad_medida" ALTER COLUMN lab_id DROP NOT NULL;

-- 2. Reemplazar unique index de unidad_medida por dos parciales
DROP INDEX IF EXISTS "idx_unidad_medida_lab_nombre";
CREATE UNIQUE INDEX "idx_unidad_medida_global_nombre"
  ON "unidad_medida" (lower(nombre))
  WHERE lab_id IS NULL;
CREATE UNIQUE INDEX "idx_unidad_medida_lab_nombre"
  ON "unidad_medida" (lab_id, lower(nombre))
  WHERE lab_id IS NOT NULL;

-- 3. Hacer lab_id nullable en practice_unidad
ALTER TABLE "practice_unidad" ALTER COLUMN lab_id DROP NOT NULL;

-- 4. Reemplazar unique index de practice_unidad por dos parciales
DROP INDEX IF EXISTS "idx_practice_unidad_unique";
CREATE UNIQUE INDEX "idx_practice_unidad_global_unique"
  ON "practice_unidad" (practice_id, unidad_id)
  WHERE lab_id IS NULL;
CREATE UNIQUE INDEX "idx_practice_unidad_lab_unique"
  ON "practice_unidad" (lab_id, practice_id, unidad_id)
  WHERE lab_id IS NOT NULL;
