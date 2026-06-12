import 'dotenv/config';
import postgres from 'postgres';

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set.');

  const sql = postgres(url, { max: 1, prepare: false });

  try {
    const tables = await sql<{ table_name: string }[]>`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `;
    console.log('\n=== TABLES in public ===');
    if (tables.length === 0) console.log('  (none)');
    else for (const t of tables) console.log(`  ${t.table_name}`);

    const enums = await sql<{ typname: string }[]>`
      SELECT typname
      FROM pg_type
      WHERE typtype = 'e'
        AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
      ORDER BY typname
    `;
    console.log('\n=== ENUMS in public ===');
    if (enums.length === 0) console.log('  (none)');
    else for (const e of enums) console.log(`  ${e.typname}`);

    const sequences = await sql<{ sequence_name: string }[]>`
      SELECT sequence_name
      FROM information_schema.sequences
      WHERE sequence_schema = 'public'
      ORDER BY sequence_name
    `;
    console.log('\n=== SEQUENCES in public ===');
    if (sequences.length === 0) console.log('  (none)');
    else for (const s of sequences) console.log(`  ${s.sequence_name}`);

    const extensions = await sql<{ extname: string }[]>`
      SELECT extname FROM pg_extension ORDER BY extname
    `;
    console.log('\n=== EXTENSIONS ===');
    for (const e of extensions) console.log(`  ${e.extname}`);

    const drizzleMig = await sql<{ id: number; hash: string; created_at: string }[]>`
      SELECT id, hash, created_at FROM drizzle.__drizzle_migrations
      ORDER BY id
    `.catch(() => []);
    console.log('\n=== DRIZZLE MIGRATIONS ===');
    if (drizzleMig.length === 0) console.log('  (none — table missing or empty)');
    else for (const m of drizzleMig) console.log(`  ${m.id}: ${m.hash} @ ${m.created_at}`);
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Inspect failed:', err);
    process.exit(1);
  });
