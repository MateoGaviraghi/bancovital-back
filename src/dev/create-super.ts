/**
 * Script one-shot: crea el superusuario cross-tenant.
 * Uso: pnpm tsx src/dev/create-super.ts
 */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { closeDb, getDb } from '@/db/client';
import { user } from '@/db/schema';

const SUPER_EMAIL = process.env.SUPER_EMAIL ?? 'super@bancovital.app';
const SUPER_PASSWORD = process.env.SUPER_PASSWORD;
if (!SUPER_PASSWORD) {
  throw new Error('SUPER_PASSWORD no esta seteada en el entorno (.env). No se hardcodea en el repo.');
}

async function main() {
  const adminClient = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  // Buscar o crear en Auth
  const list = await adminClient.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (list.error) throw new Error(`listUsers failed: ${list.error.message}`);
  let userId = list.data.users.find((u) => u.email === SUPER_EMAIL)?.id;

  if (!userId) {
    const created = await adminClient.auth.admin.createUser({
      email: SUPER_EMAIL,
      password: SUPER_PASSWORD,
      email_confirm: true,
      app_metadata: { role: 'super' },
    });
    if (created.error || !created.data.user) {
      throw new Error(`createUser failed: ${created.error?.message ?? 'unknown'}`);
    }
    userId = created.data.user.id;
    console.log(`✓ Usuario creado en Auth (id=${userId})`);
  } else {
    // Actualizar app_metadata por si cambió
    await adminClient.auth.admin.updateUserById(userId, {
      app_metadata: { role: 'super' },
    });
    console.log(`✓ Usuario ya existe en Auth, app_metadata actualizado (id=${userId})`);
  }

  // Upsert en public.user (labId NULL = superusuario cross-tenant)
  const db = getDb();
  await db
    .insert(user)
    .values({
      id: userId,
      labId: null,          // cross-tenant
      email: SUPER_EMAIL,
      displayName: 'Super Admin',
      role: 'super',
      active: true,
    })
    .onConflictDoUpdate({
      target: user.id,
      set: { role: 'super', active: true, labId: null },
    });

  console.log(`✓ Fila en public.user upserted`);
  console.log('');
  console.log('Superusuario listo:');
  console.log(`  Email:    ${SUPER_EMAIL}`);
  console.log('  Password: la de SUPER_PASSWORD en tu .env');
}

main()
  .then(async () => { await closeDb(); process.exit(0); })
  .catch(async (err) => { console.error('Error:', err); await closeDb(); process.exit(1); });
