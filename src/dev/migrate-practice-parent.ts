/**
 * Agrega la columna parent_id a la tabla practice.
 * Ejecutar UNA SOLA VEZ: npx tsx src/dev/migrate-practice-parent.ts
 */
import 'dotenv/config';
import postgres from 'postgres';

async function main() {
  const sql = postgres(process.env.DATABASE_URL!);

  await sql`
    ALTER TABLE practice
    ADD COLUMN IF NOT EXISTS parent_id bigint REFERENCES practice(id) ON DELETE RESTRICT
  `;
  console.log('✓ columna parent_id OK');

  await sql`
    CREATE INDEX IF NOT EXISTS idx_practice_parent
    ON practice (parent_id)
    WHERE parent_id IS NOT NULL
  `;
  console.log('✓ indice idx_practice_parent OK');

  await sql.end();
  console.log('\n✓ Migración completada');
}

main().catch(async (e) => { console.error(e); process.exit(1); });
