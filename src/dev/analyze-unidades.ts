import 'dotenv/config';
import { closeDb, getDb } from '@/db/client';
import { sql } from 'drizzle-orm';

async function main() {
  const db = getDb();

  // Unidades por lab (sin Cartesian)
  const porLab = await db.execute(sql`
    SELECT l.id, l.slug,
      (SELECT COUNT(*)::int FROM unidad_medida u WHERE u.lab_id = l.id) AS unidades,
      (SELECT COUNT(*)::int FROM practice_unidad pu WHERE pu.lab_id = l.id) AS asociaciones
    FROM laboratorio l
    ORDER BY l.id
  `);
  console.log('Unidades y asociaciones por lab:');
  for (const r of porLab) console.log(' ', r);

  // Nombres duplicados entre labs (antes de la globalización)
  const dupes = await db.execute(sql`
    SELECT lower(nombre) AS nombre, array_agg(DISTINCT lab_id ORDER BY lab_id) AS labs, COUNT(*)::int AS total
    FROM unidad_medida
    GROUP BY lower(nombre)
    HAVING COUNT(DISTINCT lab_id) > 1
    ORDER BY nombre
  `);
  console.log('\nNombres en múltiples labs (' + dupes.length + '):');
  for (const r of dupes) console.log(' ', r);

  // Unidades en actitud-plus (las que acabo de crear)
  const actitudUnidades = await db.execute(sql`
    SELECT COUNT(*)::int AS count FROM unidad_medida WHERE lab_id = 5
  `);
  console.log('\nUnidades en actitud-plus (lab 5):', actitudUnidades[0]);

  // ¿Tienen las mismas unidades cbiviale y actitud-plus?
  const overlap = await db.execute(sql`
    SELECT COUNT(*)::int AS nombres_comunes
    FROM unidad_medida a
    JOIN unidad_medida b ON lower(a.nombre) = lower(b.nombre) AND a.lab_id != b.lab_id
    WHERE a.lab_id = 5
  `);
  console.log('Solapamiento cbiviale ↔ actitud-plus:', overlap[0]);

  await closeDb();
}
main().catch(e => { console.error(e); process.exit(1); });
