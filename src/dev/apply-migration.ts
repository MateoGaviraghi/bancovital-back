/**
 * Aplica un archivo SQL de migration contra la DB apuntada por DATABASE_URL.
 * Idempotente: las migraciones del proyecto están escritas con IF NOT EXISTS
 * y DO blocks, así que correrla dos veces no rompe nada.
 *
 * Uso:
 *   pnpm exec ts-node -r tsconfig-paths/register src/dev/apply-migration.ts <archivo.sql>
 *
 * Ejemplo (contra dev):
 *   pnpm exec ts-node -r tsconfig-paths/register src/dev/apply-migration.ts src/db/migrations/0004_mute_frank_castle.sql
 *
 * Ejemplo (contra prod, override DATABASE_URL):
 *   DATABASE_URL=postgresql://...pooler.supabase.com:6543/postgres \
 *     pnpm exec ts-node -r tsconfig-paths/register src/dev/apply-migration.ts src/db/migrations/0004_mute_frank_castle.sql
 */
import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import postgres from 'postgres';

async function main() {
  const file = process.argv[2];
  if (!file) {
    console.error('Falta el path al archivo SQL.');
    process.exit(1);
  }
  const sqlText = readFileSync(resolve(file), 'utf8');
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL no seteado');

  console.log(`Aplicando ${file} contra ${maskUrl(url)}`);
  const sql = postgres(url, { max: 1, prepare: false });
  try {
    // Las migraciones de drizzle separan statements con `--> statement-breakpoint`.
    // Las ejecutamos una por una para que los errores reporten el statement exacto.
    // OJO: NO filtramos statements que empiezan con comentarios — PostgreSQL los
    // procesa sin problema y muchos statements de la migration tienen un comment
    // descriptivo al inicio (filtrar por ^-- saltearía la mitad de la migration).
    const statements = sqlText
      .split(/-->\s*statement-breakpoint/)
      .map((s) => s.trim())
      .filter((s) => {
        if (s.length === 0) return false;
        // Solo filtrar si TODO el chunk es puro comentario (sin SQL real)
        const nonComment = s
          .split('\n')
          .map((l) => l.trim())
          .filter((l) => l.length > 0 && !l.startsWith('--') && !l.startsWith('/*'));
        return nonComment.length > 0;
      });

    let ok = 0;
    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i];
      try {
        await sql.unsafe(stmt);
        ok++;
      } catch (err) {
        console.error(`\n✗ Statement #${i + 1} falló:`);
        console.error(stmt.slice(0, 300));
        throw err;
      }
    }
    console.log(`✓ ${ok}/${statements.length} statements aplicados sin error`);
  } finally {
    await sql.end({ timeout: 5 });
  }
}

function maskUrl(u: string): string {
  return u.replace(/:[^:@]+@/, ':***@');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
