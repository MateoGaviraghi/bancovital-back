import postgres from 'postgres';
import * as dotenv from 'dotenv';
dotenv.config();

const sql = postgres(process.env.DATABASE_URL!);

async function columnExists(table: string, column: string): Promise<boolean> {
  const rows = await sql`
    SELECT 1 FROM information_schema.columns
    WHERE table_name = ${table} AND column_name = ${column}
  `;
  return rows.length > 0;
}

async function main() {
  // 0028: ubs_snapshot, ub_value_snapshot on cotizacion_item; copago_porc on cotizacion
  if (!(await columnExists('cotizacion_item', 'ubs_snapshot'))) {
    await sql`ALTER TABLE "cotizacion_item" ADD COLUMN "ubs_snapshot" numeric(8, 2)`;
    console.log('✓ cotizacion_item.ubs_snapshot created');
  } else {
    console.log('  cotizacion_item.ubs_snapshot already exists');
  }

  if (!(await columnExists('cotizacion_item', 'ub_value_snapshot'))) {
    await sql`ALTER TABLE "cotizacion_item" ADD COLUMN "ub_value_snapshot" numeric(12, 2)`;
    console.log('✓ cotizacion_item.ub_value_snapshot created');
  } else {
    console.log('  cotizacion_item.ub_value_snapshot already exists');
  }

  if (!(await columnExists('cotizacion', 'copago_porc'))) {
    await sql`ALTER TABLE "cotizacion" ADD COLUMN "copago_porc" numeric(5, 2)`;
    console.log('✓ cotizacion.copago_porc created');
  } else {
    console.log('  cotizacion.copago_porc already exists');
  }

  // 0029: precio_particular on practice
  if (!(await columnExists('practice', 'precio_particular'))) {
    await sql`ALTER TABLE "practice" ADD COLUMN "precio_particular" numeric(12, 2)`;
    console.log('✓ practice.precio_particular created');
  } else {
    console.log('  practice.precio_particular already exists');
  }

  await sql.end();
}

main().catch(console.error);
