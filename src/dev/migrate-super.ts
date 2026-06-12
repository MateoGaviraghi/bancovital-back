import 'dotenv/config';
import { sql } from 'drizzle-orm';
import { getDb, closeDb } from '@/db/client';

async function main() {
  const db = getDb();

  try {
    await db.execute(sql`ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'super'`);
    console.log('✓ user_role enum: valor super agregado');
  } catch(e: unknown) { console.log('user_role enum:', (e as Error).message); }

  try {
    await db.execute(sql`ALTER TABLE "user" ALTER COLUMN lab_id DROP NOT NULL`);
    console.log('✓ lab_id: restricción NOT NULL eliminada');
  } catch(e: unknown) { console.log('lab_id nullable:', (e as Error).message); }

  await closeDb();
}

main().catch(console.error);
