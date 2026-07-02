#!/usr/bin/env node
// Falla si alguna tabla del schema con columna `lab_id` (tenant) no tiene RLS
// habilitada en src/db/migrations/_post.sql. Evita que se repita el drift de la
// auditoría 2026-07 (tablas tenant quedaron expuestas al anon key de Supabase
// porque se agregaron sin ENABLE ROW LEVEL SECURITY).
//
// Solo lee archivos (sin DB, sin deps) → apto para CI. Uso: node scripts/check-rls-coverage.mjs
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const schemaDir = join(root, 'src/db/schema');
const postPath = join(root, 'src/db/migrations/_post.sql');

// 1. Tablas del schema drizzle con columna lab_id → tenant, deben tener RLS.
const tenant = new Set();
for (const file of readdirSync(schemaDir).filter((f) => f.endsWith('.ts'))) {
  const src = readFileSync(join(schemaDir, file), 'utf8');
  // Troceamos por cada pgTable( para aislar la definición de cada tabla.
  for (const part of src.split(/pgTable\s*\(/).slice(1)) {
    const name = part.match(/^\s*['"]([A-Za-z0-9_]+)['"]/)?.[1];
    if (name && /['"]lab_id['"]/.test(part)) tenant.add(name);
  }
}

// 2. Tablas con RLS habilitada en _post.sql (con o sin comillas / IF EXISTS / public.).
const post = readFileSync(postPath, 'utf8');
const withRls = new Set();
const re = /ALTER TABLE\s+(?:IF\s+EXISTS\s+)?(?:public\.)?"?([A-Za-z0-9_]+)"?\s+ENABLE ROW LEVEL SECURITY/gi;
for (let m = re.exec(post); m; m = re.exec(post)) withRls.add(m[1]);

// 3. Diff → falla si falta alguna.
const missing = [...tenant].filter((t) => !withRls.has(t)).sort();
if (missing.length > 0) {
  console.error('❌ Tablas con lab_id SIN RLS en _post.sql (exposicion via anon key):');
  for (const t of missing) console.error('   - ' + t);
  console.error(
    '\nAgrega en src/db/migrations/_post.sql:\n' +
      missing.map((t) => `  ALTER TABLE public."${t}" ENABLE ROW LEVEL SECURITY;`).join('\n'),
  );
  process.exit(1);
}
console.log(`✅ RLS OK: las ${tenant.size} tablas con lab_id tienen RLS en _post.sql.`);
