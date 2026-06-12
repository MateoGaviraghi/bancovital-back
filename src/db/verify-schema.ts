import 'dotenv/config';
import postgres from 'postgres';

const EXPECTED: Record<string, number> = {
  attachment: 8,
  audit_log: 10,
  doctor: 12,
  insurer: 7,
  lab_config: 15,
  order: 24,
  order_practice: 15,
  patient: 15,
  payment: 7,
  practice: 13,
  result: 14,
  ub_value: 8,
  user: 7,
};

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set.');
  const sql = postgres(url, { max: 1, prepare: false });

  try {
    const rows = await sql<{ table_name: string; count: number }[]>`
      SELECT table_name, COUNT(*)::int AS count
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = ANY(${Object.keys(EXPECTED)})
      GROUP BY table_name
      ORDER BY table_name
    `;

    const actual: Record<string, number> = {};
    for (const r of rows) actual[r.table_name] = r.count;

    console.log('table             expected  actual  match');
    console.log('---------------   --------  ------  -----');
    let allOk = true;
    for (const [table, exp] of Object.entries(EXPECTED)) {
      const got = actual[table] ?? 0;
      const ok = got === exp;
      if (!ok) allOk = false;
      console.log(
        `${table.padEnd(17)} ${String(exp).padStart(8)} ${String(got).padStart(7)}   ${ok ? 'OK' : 'MISMATCH'}`,
      );
    }
    console.log(`\nOverall: ${allOk ? 'ALL MATCH' : 'MISMATCH — needs DROP + reapply'}`);
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Verify failed:', err);
    process.exit(1);
  });
