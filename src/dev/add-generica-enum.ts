import postgres from 'postgres';
import * as dotenv from 'dotenv';
dotenv.config();

const sql = postgres(process.env.DATABASE_URL!);

async function main() {
  await sql`ALTER TYPE cotizacion_tipo ADD VALUE IF NOT EXISTS 'generica'`;
  console.log('✓ valor generica agregado al enum cotizacion_tipo');
  await sql.end();
}

main().catch(console.error);
