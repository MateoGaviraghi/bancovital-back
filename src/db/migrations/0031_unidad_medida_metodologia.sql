-- Add metodologia column to unidad_medida
ALTER TABLE unidad_medida ADD COLUMN IF NOT EXISTS metodologia text;
