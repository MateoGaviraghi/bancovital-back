import postgres from 'postgres';
import * as dotenv from 'dotenv';
dotenv.config();

const sql = postgres(process.env.DATABASE_URL!);

async function main() {
  // Check if column exists
  const rows = await sql`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_name = 'practice' AND column_name = 'precio_particular'
  `;

  if (rows.length > 0) {
    console.log('Column precio_particular already exists.');
  } else {
    await sql`ALTER TABLE "practice" ADD COLUMN "precio_particular" numeric(12, 2)`;
    console.log('Column precio_particular created successfully.');
  }

  // Show all practice columns
  const cols = await sql`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'practice' ORDER BY ordinal_position
  `;
  console.log('Practice columns:', cols.map((r: any) => r.column_name).join(', '));

  await sql.end();
}

main().catch(console.error);
