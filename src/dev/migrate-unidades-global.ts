/**
 * Migración de datos: consolida todas las unidades de medida y asociaciones
 * práctica-unidad como GLOBALES (lab_id = NULL).
 *
 * Algoritmo:
 * 1. Deduplica unidad_medida: por cada nombre repetido, elige un ganador
 *    (prioriza lab_id=5 por opciones_predeterminadas completas).
 *    Redirige order_practice_unidad_value y practice_unidad al ganador, luego borra el perdedor.
 * 2. Pasa todas las unidades a lab_id = NULL.
 * 3. Deduplica practice_unidad y pasa todo a lab_id = NULL.
 *
 * Idempotente.
 */
import 'dotenv/config';
import { closeDb, getDb } from '@/db/client';
import { sql } from 'drizzle-orm';

async function run() {
  const db = getDb();

  const before = await db.execute(sql`
    SELECT
      (SELECT COUNT(*)::int FROM unidad_medida WHERE lab_id IS NOT NULL) AS um_per_lab,
      (SELECT COUNT(*)::int FROM unidad_medida WHERE lab_id IS NULL)     AS um_global,
      (SELECT COUNT(*)::int FROM practice_unidad WHERE lab_id IS NOT NULL) AS pu_per_lab,
      (SELECT COUNT(*)::int FROM practice_unidad WHERE lab_id IS NULL)   AS pu_global
  `);
  console.log('Estado inicial:', before[0]);

  // ── Fase 1: deduplicar unidad_medida ────────────────────────────────────
  console.log('\n[1/4] Deduplicando unidad_medida...');

  const dupes = await db.execute<{ keep_id: number; del_id: number }>(sql`
    WITH ranked AS (
      SELECT
        id,
        lower(nombre) AS nom,
        RANK() OVER (
          PARTITION BY lower(nombre)
          ORDER BY
            CASE WHEN lab_id = 5  THEN 0
                 WHEN lab_id IS NULL THEN 1
                 ELSE 2 END,
            id
        ) AS rk
      FROM unidad_medida
    ),
    keepers AS (SELECT id AS keep_id, nom FROM ranked WHERE rk = 1)
    SELECT r.id AS del_id, k.keep_id
    FROM ranked r
    JOIN keepers k ON r.nom = k.nom
    WHERE r.rk > 1
  `);

  console.log(`  ${dupes.length} duplicados a resolver`);

  for (const { keep_id, del_id } of dupes) {
    // 1a. Redirigir order_practice_unidad_value: si ya existe la dupla (op_id, keep_id), borrar; si no, actualizar
    await db.execute(sql`
      DELETE FROM order_practice_unidad_value
      WHERE unidad_id = ${del_id}
        AND EXISTS (
          SELECT 1 FROM order_practice_unidad_value ov2
          WHERE ov2.order_practice_id = order_practice_unidad_value.order_practice_id
            AND ov2.unidad_id = ${keep_id}
        )
    `);
    await db.execute(sql`
      UPDATE order_practice_unidad_value SET unidad_id = ${keep_id} WHERE unidad_id = ${del_id}
    `);

    // 1b. Redirigir practice_unidad al ganador
    await db.execute(sql`
      DELETE FROM practice_unidad
      WHERE unidad_id = ${del_id}
        AND EXISTS (
          SELECT 1 FROM practice_unidad pu2
          WHERE pu2.practice_id = practice_unidad.practice_id
            AND pu2.unidad_id = ${keep_id}
            AND (
              pu2.lab_id = practice_unidad.lab_id
              OR (pu2.lab_id IS NULL AND practice_unidad.lab_id IS NULL)
            )
        )
    `);
    await db.execute(sql`
      UPDATE practice_unidad SET unidad_id = ${keep_id} WHERE unidad_id = ${del_id}
    `);

    // 1c. Eliminar el perdedor
    await db.execute(sql`DELETE FROM unidad_medida WHERE id = ${del_id}`);
  }
  console.log(`  ✅ ${dupes.length} duplicados resueltos`);

  // ── Fase 2: unidad_medida → lab_id = NULL ────────────────────────────────
  console.log('\n[2/4] Pasando unidades a global (lab_id = NULL)...');
  await db.execute(sql`UPDATE unidad_medida SET lab_id = NULL WHERE lab_id IS NOT NULL`);
  const umCount = await db.execute<{n: number}>(sql`SELECT COUNT(*)::int AS n FROM unidad_medida WHERE lab_id IS NULL`);
  console.log(`  ✅ ${umCount[0]?.n ?? '?'} unidades ahora globales`);

  // ── Fase 3: deduplicar practice_unidad ───────────────────────────────────
  console.log('\n[3/4] Deduplicando practice_unidad...');
  const puDupes = await db.execute<{ del_id: number }>(sql`
    WITH ranked AS (
      SELECT
        id,
        RANK() OVER (
          PARTITION BY practice_id, unidad_id
          ORDER BY
            CASE WHEN lab_id = 5  THEN 0
                 WHEN lab_id IS NULL THEN 1
                 ELSE 2 END,
            id
        ) AS rk
      FROM practice_unidad
    )
    SELECT id AS del_id FROM ranked WHERE rk > 1
  `);
  console.log(`  ${puDupes.length} asociaciones duplicadas a eliminar`);
  if (puDupes.length > 0) {
    const ids = puDupes.map((r) => r.del_id);
    for (let i = 0; i < ids.length; i += 200) {
      const batch = ids.slice(i, i + 200);
      await db.execute(
        sql`DELETE FROM practice_unidad WHERE id IN (${sql.join(batch.map((id) => sql`${id}`), sql`, `)})`,
      );
    }
  }
  console.log('  ✅ Duplicados de practice_unidad eliminados');

  // ── Fase 4: practice_unidad → lab_id = NULL ───────────────────────────────
  console.log('\n[4/4] Pasando asociaciones a global (lab_id = NULL)...');
  await db.execute(sql`UPDATE practice_unidad SET lab_id = NULL WHERE lab_id IS NOT NULL`);
  const puCount = await db.execute<{n: number}>(sql`SELECT COUNT(*)::int AS n FROM practice_unidad WHERE lab_id IS NULL`);
  console.log(`  ✅ ${puCount[0]?.n ?? '?'} asociaciones ahora globales`);

  // ── Estado final ─────────────────────────────────────────────────────────
  const after = await db.execute(sql`
    SELECT
      (SELECT COUNT(*)::int FROM unidad_medida WHERE lab_id IS NOT NULL)   AS um_per_lab,
      (SELECT COUNT(*)::int FROM unidad_medida WHERE lab_id IS NULL)       AS um_global,
      (SELECT COUNT(*)::int FROM practice_unidad WHERE lab_id IS NOT NULL) AS pu_per_lab,
      (SELECT COUNT(*)::int FROM practice_unidad WHERE lab_id IS NULL)     AS pu_global,
      (SELECT COUNT(DISTINCT lower(nombre))::int FROM unidad_medida)       AS nombres_distintos
  `);
  console.log('\nEstado final:', after[0]);

  await closeDb();
}

run()
  .then(() => { console.log('\n✅ Migración completada.'); process.exit(0); })
  .catch((err) => { console.error('\n❌ Error:', err); closeDb().finally(() => process.exit(1)); });
