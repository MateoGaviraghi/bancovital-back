/**
 * One-shot: resetea la contraseña del superusuario a un valor conocido y
 * garantiza app_metadata.role = 'super' + fila en public.user (labId null).
 * Uso: pnpm dlx tsx src/dev/reset-super-password.ts
 */
import 'dotenv/config';
import { closeDb, getDb } from '@/db/client';
import { user } from '@/db/schema';
import { createClient } from '@supabase/supabase-js';

const EMAIL = process.env.SUPER_EMAIL ?? 'super@bancovital.app';
const NEW_PASSWORD = process.env.NEW_SUPER_PASSWORD ?? 'NodoSuper2026!';

async function main() {
  const admin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const list = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (list.error) throw new Error(list.error.message);
  let u = list.data.users.find((x) => x.email === EMAIL);

  if (!u) {
    const created = await admin.auth.admin.createUser({
      email: EMAIL,
      password: NEW_PASSWORD,
      email_confirm: true,
      app_metadata: { role: 'super' },
    });
    if (created.error || !created.data.user)
      throw new Error(created.error?.message ?? 'createUser failed');
    u = created.data.user;
    console.log('Superusuario creado en Auth');
  } else {
    const upd = await admin.auth.admin.updateUserById(u.id, {
      password: NEW_PASSWORD,
      app_metadata: { role: 'super' },
    });
    if (upd.error) throw new Error(upd.error.message);
    console.log('Contraseña y rol reseteados en Auth');
  }

  const db = getDb();
  await db
    .insert(user)
    .values({
      id: u.id,
      labId: null,
      email: EMAIL,
      displayName: 'Super Admin',
      role: 'super',
      active: true,
    })
    .onConflictDoUpdate({ target: user.id, set: { role: 'super', active: true, labId: null } });

  console.log('public.user OK (role=super, labId=null)');
  console.log('');
  console.log(`Email:    ${EMAIL}`);
  console.log(`Password: ${NEW_PASSWORD}`);
}

main()
  .then(async () => {
    await closeDb();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error('Error:', err);
    await closeDb();
    process.exit(1);
  });
