/**
 * DESTRUCTIVE: drops everything in the public schema (and the drizzle
 * migration journal, so migrations re-apply from 0000) and re-applies the
 * full setup (extensions, sequence, Drizzle migrations, RLS, triggers). All
 * data in public.* is permanently lost. Auth/storage/other Supabase schemas
 * are untouched.
 *
 * Requires --yes to run.
 */
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
  if (!process.argv.includes('--yes')) {
    console.error(
      'Refusing to run without --yes. This command DROPS all tables in schema public.',
    );
    process.exit(2);
  }

  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set.');

  const host = new URL(url.replace('postgresql://', 'http://')).hostname;
  console.log(`Target host: ${host}`);
  console.log('Resetting public schema in 2 seconds (Ctrl+C to abort)...');
  await new Promise((r) => setTimeout(r, 2000));

  const raw = postgres(url, { max: 1, prepare: false });

  try {
    console.log('\n1) DROP + recreate schema public...');
    await raw.unsafe(`
      DROP SCHEMA IF EXISTS public CASCADE;
      DROP SCHEMA IF EXISTS drizzle CASCADE;
      CREATE SCHEMA public;
      GRANT ALL ON SCHEMA public TO postgres;
      GRANT ALL ON SCHEMA public TO anon;
      GRANT ALL ON SCHEMA public TO authenticated;
      GRANT ALL ON SCHEMA public TO service_role;
    `);
    console.log('  public schema recreated.');

    console.log('\n2) Applying _prereq.sql (extensions + seq_protocol)...');
    await runSqlFile(raw, '_prereq.sql');

    console.log('\n3) Running Drizzle migrations...');
    const db = getDb();
    await migrate(db, { migrationsFolder: MIGRATIONS_DIR });
    console.log('  Drizzle migrations applied.');

    console.log('\n4) Applying _post.sql (RLS + immutability triggers)...');
    await runSqlFile(raw, '_post.sql');

    console.log('\nReset completed successfully.');
  } finally {
    await raw.end({ timeout: 5 });
    await closeDb();
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Reset failed:', err);
    process.exit(1);
  });
