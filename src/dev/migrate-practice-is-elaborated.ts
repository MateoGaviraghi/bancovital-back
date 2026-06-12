/**
 * Agrega la columna is_elaborated a la tabla practice.
 * Ejecutar UNA SOLA VEZ: npx tsx src/dev/migrate-practice-is-elaborated.ts
 */
import 'dotenv/config';
import postgres from 'postgres';

async function main() {
  const sql = postgres(process.env.DATABASE_URL!);

  await sql`
    ALTER TABLE practice
    ADD COLUMN IF NOT EXISTS is_elaborated boolean NOT NULL DEFAULT false
  `;
  console.log('✓ columna is_elaborated OK');

  await sql.end();
  console.log('\n✓ Migración completada');
}

main().catch(async (e) => {
  console.error(e);
  process.exit(1);
});
