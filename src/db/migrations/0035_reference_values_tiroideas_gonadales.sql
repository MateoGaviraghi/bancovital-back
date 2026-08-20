-- ─── Descriptive reference values: hormonas con rangos condicionales ─────────
-- (hasta que esté implementado el gap 1 de rangos condicionales por sexo/edad/fase)

-- T3 LIBRE — 4 franjas etarias
UPDATE practice
SET reference_value = 'Adultos: 2,30–4,20 pg/ml · 1–23 meses: 3,30–5,20 pg/ml · 2–12 años: 3,30–4,80 pg/ml · 13–20 años: 3,00–4,70 pg/ml',
    updated_at = now()
WHERE id = 1411;

-- FSH — sexo + fase del ciclo
UPDATE practice
SET reference_value = 'Hombre: 1,4–18,1 mUI/ml · Mujer folicular: 2,5–10,2 mUI/ml · Mitad ciclo: 3,4–33,4 mUI/ml · Fase lútea: 1,5–9,1 mUI/ml · Postmenopausia: 23,0–116,3 mUI/ml',
    updated_at = now()
WHERE id = 178;

-- LH — sexo + fase del ciclo
UPDATE practice
SET reference_value = 'Hombre: 1,5–9,3 mUI/ml · Mujer folicular: 1,9–12,5 mUI/ml · Mitad ciclo: 8,7–76,3 mUI/ml · Fase lútea: 0,5–16,9 mUI/ml · Postmenopausia: 15,9–54,0 mUI/ml',
    updated_at = now()
WHERE id = 262;

-- FERRITINA — sexo
UPDATE practice
SET reference_value = 'Hombre adulto: 20–320 ng/ml · Mujer adulta: 10–280 ng/ml',
    updated_at = now()
WHERE id = 852;

-- ─── IONOGRAMA: CLORO ─────────────────────────────────────────────────────────
UPDATE practice
SET reference_value = '98 – 107 mEq/l', updated_at = now()
WHERE id = 91;

-- ─── COAGULOGRAMA (94) ───────────────────────────────────────────────────────
-- Corregir rango del Tiempo de Protrombina (era 11-14, correcto es 12-15 seg)
UPDATE practice_unidad
SET range_low = 12, range_high = 15,
    reference_text = '12 – 15 segundos',
    updated_at = now()
WHERE id = 159;  -- pu 159 = Tiempo de protrombina

-- Agregar KPTT (um 271 ya existe con simbolo='seg')
INSERT INTO practice_unidad (practice_id, unidad_id, sort_order, range_low, range_high, reference_text)
VALUES (94, 271, 2, 30, 45, '30 – 45 segundos')
ON CONFLICT DO NOTHING;

UPDATE practice SET reference_value = 'T.Protrombina 12–15 s · RIN 0,8–1,2 · KPTT 30–45 s', updated_at = now()
WHERE id = 94;

-- ─── PROTEINOGRAMA ELECTROFORÉTICO (329) ─────────────────────────────────────

-- 1. Proteínas totales (pu 386, um 272): set range
UPDATE practice_unidad
SET range_low = 6.4, range_high = 8.2, reference_text = '6,4 – 8,2 g/dl', updated_at = now()
WHERE id = 386;

-- 2. Albúmina (pu 387, um 120): set range
UPDATE practice_unidad
SET range_low = 3.39, range_high = 4.63, reference_text = '3,39 – 4,63 g/dl', updated_at = now()
WHERE id = 387;

-- 3. α1-globulina (um 273): cambiar símbolo de % a g/dl, set range
UPDATE unidad_medida SET simbolo = 'g/dl', updated_at = now() WHERE id = 273;
UPDATE practice_unidad
SET range_low = 0.18, range_high = 0.44, reference_text = '0,18 – 0,44 g/dl', updated_at = now()
WHERE id = 388;

-- 4. α2-globulina (um 274): cambiar símbolo, set range
UPDATE unidad_medida SET simbolo = 'g/dl', updated_at = now() WHERE id = 274;
UPDATE practice_unidad
SET range_low = 0.50, range_high = 0.95, reference_text = '0,50 – 0,95 g/dl', updated_at = now()
WHERE id = 389;

-- 5. β-globulina → β1-globulina (um 275): renombrar, cambiar símbolo, set range
UPDATE unidad_medida SET nombre = 'β1-globulina', simbolo = 'g/dl', updated_at = now() WHERE id = 275;
UPDATE practice_unidad
SET range_low = 0.32, range_high = 0.56, reference_text = '0,32 – 0,56 g/dl', updated_at = now()
WHERE id = 390;

-- 6. β2-globulina (nueva): crear unidad_medida y practice_unidad en sort=5
INSERT INTO unidad_medida (nombre, simbolo, active)
VALUES ('β2-globulina', 'g/dl', true)
ON CONFLICT DO NOTHING;

-- Primero desplazar γ-globulina (sort 5→6) y Relación A/G (sort 6→7)
UPDATE practice_unidad SET sort_order = 7, updated_at = now() WHERE id = 392;  -- A/G
UPDATE practice_unidad SET sort_order = 6, updated_at = now() WHERE id = 391;  -- γ-globulina

INSERT INTO practice_unidad (practice_id, unidad_id, sort_order, range_low, range_high, reference_text)
SELECT 329, um.id, 5, 0.20, 0.46, '0,20 – 0,46 g/dl'
FROM unidad_medida um WHERE um.nombre = 'β2-globulina' AND um.lab_id IS NULL
ON CONFLICT DO NOTHING;

-- 7. γ-globulina (um 276): cambiar símbolo a g/dl, set range
UPDATE unidad_medida SET simbolo = 'g/dl', updated_at = now() WHERE id = 276;
UPDATE practice_unidad
SET range_low = 0.61, range_high = 1.66, reference_text = '0,61 – 1,66 g/dl', updated_at = now()
WHERE id = 391;

-- 8. Relación A/G (um 277): marcar como calculada
UPDATE unidad_medida
SET es_calculada = true,
    formula      = 'Albúmina / (Proteínas totales − Albúmina)',
    simbolo      = null,
    updated_at   = now()
WHERE id = 277;

UPDATE practice
SET reference_value = 'Proteínas totales 6,4–8,2 g/dl · Albúmina 3,39–4,63 g/dl · α1 0,18–0,44 · α2 0,50–0,95 · β1 0,32–0,56 · β2 0,20–0,46 · γ 0,61–1,66 · A/G calculado',
    updated_at = now()
WHERE id = 329;
