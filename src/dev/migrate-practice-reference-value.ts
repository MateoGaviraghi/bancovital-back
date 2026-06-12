/**
 * Agrega la columna reference_value a la tabla practice.
 * Ejecutar UNA SOLA VEZ: npx tsx src/dev/migrate-practice-reference-value.ts
 */
import 'dotenv/config';
import postgres from 'postgres';

async function main() {
  const sql = postgres(process.env.DATABASE_URL!);

  await sql`
    ALTER TABLE practice
    ADD COLUMN IF NOT EXISTS reference_value text
  `;
  console.log('✓ columna reference_value OK');

  await sql.end();
  console.log('\n✓ Migración completada');
}

main().catch(async (e) => {
  console.error(e);
  process.exit(1);
});
