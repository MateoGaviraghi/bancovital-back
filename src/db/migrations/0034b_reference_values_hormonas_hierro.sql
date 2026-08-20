-- ─── Reference values: hormonas / hierro ────────────────────────────────────

-- CORTISOL (practice 109, practice_unidad 71): update range
UPDATE practice_unidad
SET range_low = 4.3, range_high = 22.4,
    reference_text = '4,3 – 22,4 µg/dl',
    updated_at = now()
WHERE id = 71;

UPDATE practice SET reference_value = '4,3 – 22,4 µg/dl', updated_at = now() WHERE id = 109;

-- FERREMIA (practice 155, practice_unidad 118): update range
UPDATE practice_unidad
SET range_low = 33, range_high = 193,
    reference_text = '33 – 193 µg/dl',
    updated_at = now()
WHERE id = 118;

UPDATE practice SET reference_value = '33 – 193 µg/dl', updated_at = now() WHERE id = 155;

-- TRANSFERRINA (practice 373, practice_unidad 179): update reference_text (range already set)
UPDATE practice_unidad
SET reference_text = '200 – 360 mg/dl', updated_at = now()
WHERE id = 179;

UPDATE practice SET reference_value = '200 – 360 mg/dl', updated_at = now() WHERE id = 373;

-- ─── CALCIO IÓNICO (practice 70) ────────────────────────────────────────────
-- Need a mmol/l unidad_medida
INSERT INTO unidad_medida (nombre, simbolo, active)
VALUES ('mmol/l', 'mmol/l', true)
ON CONFLICT DO NOTHING;

INSERT INTO practice_unidad (practice_id, unidad_id, sort_order, range_low, range_high, reference_text)
SELECT 70, um.id, 0, 1.00, 1.40, '1,00 – 1,40 mmol/l'
FROM unidad_medida um WHERE lower(um.nombre) = 'mmol/l' AND um.lab_id IS NULL
ON CONFLICT DO NOTHING;

UPDATE practice SET reference_value = '1,00 – 1,40 mmol/l', updated_at = now() WHERE id = 70;

-- ─── PROLACTINA (practice 325) ── sexo-dependiente (texto descriptivo) ───────
UPDATE practice
SET reference_value = 'Hombre adulto: 2,1 – 17,7 ng/ml · Mujer adulta: 2,8 – 29,2 ng/ml',
    updated_at = now()
WHERE id = 325;

-- ─── ESTRADIOL (practice 137) ── sexo + fase del ciclo (texto descriptivo) ──
UPDATE practice
SET reference_value = 'Hombre: hasta 39,8 pg/ml · Mujer fase folicular: 19,5 – 144,2 pg/ml · Mitad ciclo: 63,9 – 356,7 pg/ml · Fase lútea: 55,8 – 214,2 pg/ml · Postmenopausia: < 32,2 pg/ml',
    updated_at = now()
WHERE id = 137;

-- ─── SIDEROFILINA / SATURACIÓN DE LA TRANSFERRINA (practice 352) ─────────────
-- Crear unidades para los 5 componentes del panel.

-- 1. Ferremia: usar unidad ug/dl existente (id 50)
INSERT INTO practice_unidad (practice_id, unidad_id, sort_order, range_low, range_high, reference_text)
VALUES (352, 50, 0, 33, 193, '33 – 193 µg/dl')
ON CONFLICT DO NOTHING;

-- 2. Transferrina: usar unidad Transferrina existente (id 123, simbolo=mg/dl)
INSERT INTO practice_unidad (practice_id, unidad_id, sort_order, range_low, range_high, reference_text)
VALUES (352, 123, 1, 200, 360, '200 – 360 mg/dl')
ON CONFLICT DO NOTHING;

-- 3. Capacidad total de fijación (TIBC) — calculada: Transferrina (mg/dl) × 1,25
INSERT INTO unidad_medida (nombre, simbolo, active, es_calculada, formula)
VALUES ('Capacidad total de fijación', 'µg/dl', true, true, 'Transferrina × 1,25  [mg/dl → µg/dl]')
ON CONFLICT DO NOTHING;

INSERT INTO practice_unidad (practice_id, unidad_id, sort_order, range_low, range_high, reference_text)
SELECT 352, um.id, 2, 280, 360, '280 – 360 µg/dl (calculado)'
FROM unidad_medida um WHERE um.nombre = 'Capacidad total de fijación' AND um.lab_id IS NULL
ON CONFLICT DO NOTHING;

-- 4. Capacidad latente de fijación — calculada: TIBC − Ferremia
INSERT INTO unidad_medida (nombre, simbolo, active, es_calculada, formula)
VALUES ('Capacidad latente de fijación', 'µg/dl', true, true, 'Capacidad total de fijación − Ferremia')
ON CONFLICT DO NOTHING;

INSERT INTO practice_unidad (practice_id, unidad_id, sort_order, range_low, range_high, reference_text)
SELECT 352, um.id, 3, 160, 280, '160 – 280 µg/dl (calculado)'
FROM unidad_medida um WHERE um.nombre = 'Capacidad latente de fijación' AND um.lab_id IS NULL
ON CONFLICT DO NOTHING;

-- 5. Coeficiente de saturación — calculado: Ferremia / TIBC × 100
INSERT INTO unidad_medida (nombre, simbolo, active, es_calculada, formula)
VALUES ('Coeficiente de saturación', '%', true, true, '(Ferremia / Capacidad total de fijación) × 100')
ON CONFLICT DO NOTHING;

INSERT INTO practice_unidad (practice_id, unidad_id, sort_order, range_low, range_high, reference_text)
SELECT 352, um.id, 4, 20, 55, '20 – 55 % (calculado)'
FROM unidad_medida um WHERE um.nombre = 'Coeficiente de saturación' AND um.lab_id IS NULL
ON CONFLICT DO NOTHING;

UPDATE practice
SET reference_value = 'Ferremia 33–193 µg/dl · Transferrina 200–360 mg/dl · Capacidad total 280–360 µg/dl · Coeficiente de saturación 20–55 %',
    updated_at = now()
WHERE id = 352;
