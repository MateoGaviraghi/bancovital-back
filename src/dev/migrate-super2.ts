import 'dotenv/config';
import postgres from 'postgres';

async function main() {
  const sql = postgres(process.env.DATABASE_URL!);

  try {
    await sql`ALTER TABLE "user" ALTER COLUMN lab_id DROP NOT NULL`;
    console.log('✓ lab_id: restricción NOT NULL eliminada');
  } catch (e: unknown) {
    console.error('Error:', (e as Error).message);
  }

  await sql.end();
}

main().catch(console.error);
