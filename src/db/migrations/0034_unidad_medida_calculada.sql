-- Gap 2: mark unidades as auto-calculated and store their derivation formula
ALTER TABLE unidad_medida
  ADD COLUMN IF NOT EXISTS es_calculada boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS formula      text;
