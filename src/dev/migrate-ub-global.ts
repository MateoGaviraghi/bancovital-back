/**
 * Migra ub_value de per-laboratorio a global.
 * - Elimina lab_id de ub_value
 * - Deja solo el último UB vigente por insurer (el más reciente si hay conflicto)
 * - Recrea el índice único sin lab_id
 *
 * Ejecutar UNA SOLA VEZ: npx tsx src/dev/migrate-ub-global.ts
 */
import 'dotenv/config';
import postgres from 'postgres';

async function main() {
  const sql = postgres(process.env.DATABASE_URL!);

  // 1. Verificar que lab_id exista (si no, ya está migrado)
  const cols = await sql`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'ub_value' AND column_name = 'lab_id'
  `;
  if (cols.length === 0) {
    console.log('✓ lab_id ya no existe en ub_value — nada que hacer');
    await sql.end();
    return;
  }

  // 2. Eliminar filas duplicadas: si hay múltiples labs con UB vigente para la misma
  //    obra social, conservar solo la más reciente (mayor valid_from).
  //    Marcar como cerradas las filas duplicadas (valid_to = now()).
  const dupes = await sql`
    WITH ranked AS (
      SELECT id,
             ROW_NUMBER() OVER (
               PARTITION BY insurer_id
               ORDER BY valid_from DESC, id DESC
             ) AS rn
      FROM ub_value
      WHERE valid_to IS NULL
    )
    UPDATE ub_value
    SET valid_to = CURRENT_DATE
    WHERE id IN (SELECT id FROM ranked WHERE rn > 1)
    RETURNING id
  `;
  console.log(`✓ ${dupes.length} UB duplicados cerrados (valid_to = hoy)`);

  // 3. Eliminar el índice único viejo
  await sql`DROP INDEX IF EXISTS idx_ubvalue_current_per_lab_insurer`;
  console.log('✓ Índice idx_ubvalue_current_per_lab_insurer eliminado');

  // 4. Eliminar índice de lab_id si existe
  await sql`DROP INDEX IF EXISTS idx_ubvalue_lab`;
  console.log('✓ Índice idx_ubvalue_lab eliminado');

  // 5. Crear nuevo índice único global
  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_ubvalue_current_per_insurer
    ON ub_value (insurer_id)
    WHERE valid_to IS NULL
  `;
  console.log('✓ Índice idx_ubvalue_current_per_insurer creado');

  // 6. Quitar la FK constraint de lab_id y luego la columna
  await sql`
    ALTER TABLE ub_value
    DROP COLUMN IF EXISTS lab_id
  `;
  console.log('✓ Columna lab_id eliminada de ub_value');

  await sql.end();
  console.log('\n✓ Migración completada: ub_value ahora es global');
}

main().catch(async (e) => {
  console.error(e);
  process.exit(1);
});
