import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { closeDb, getDb } from './client';

const MIGRATIONS_DIR = join(__dirname, 'migrations');

async function runSqlFile(client: postgres.Sql, filename: string): Promise<void> {
  const path = join(MIGRATIONS_DIR, filename);
  const sqlText = await readFile(path, 'utf8');
  if (!sqlText.trim()) return;
  await client.unsafe(sqlText);
  console.log(`  Applied ${filename}`);
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set.');

  const raw = postgres(url, { max: 1, prepare: false });

  try {
    console.log('1) Applying _prereq.sql (extensions + sequence)...');
    await runSqlFile(raw, '_prereq.sql');

    console.log('2) Running Drizzle migrations...');
    const db = getDb();
    await migrate(db, { migrationsFolder: MIGRATIONS_DIR });
    console.log('  Drizzle migrations applied.');

    console.log('3) Applying _post.sql (RLS + immutability triggers)...');
    await runSqlFile(raw, '_post.sql');

    console.log('\nDatabase setup completed successfully.');
  } finally {
    await raw.end({ timeout: 5 });
    await closeDb();
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Setup failed:', err);
    process.exit(1);
  });
