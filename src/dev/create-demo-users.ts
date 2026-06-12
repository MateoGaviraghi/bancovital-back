/**
 * Script one-shot: crea/resetea usuarios DEMO del lab `default` (uno por rol)
 * para QA manual. Idempotente: si el usuario existe, resetea password y rol.
 * Uso: pnpm tsx src/dev/create-demo-users.ts
 * Password: DEMO_PASSWORD del entorno, o 'Demo1234!' como fallback (solo QA).
 */
import 'dotenv/config';
import { closeDb, getDb } from '@/db/client';
import { laboratorio, user } from '@/db/schema';
import { createClient } from '@supabase/supabase-js';
import { eq } from 'drizzle-orm';

const DEMO_PASSWORD = process.env.DEMO_PASSWORD ?? 'Demo1234!';
const LAB_SLUG = 'default';

const DEMO_USERS = [
  { email: 'demo.admin@bancovital.app', role: 'admin', displayName: 'Demo Admin' },
  { email: 'demo.recepcion@bancovital.app', role: 'recepcion', displayName: 'Demo Recepción' },
  { email: 'demo.bioquimico@bancovital.app', role: 'bioquimico', displayName: 'Demo Bioquímico' },
] as const;

async function main() {
  const adminClient = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const db = getDb();
  const [lab] = await db
    .select({ id: laboratorio.id })
    .from(laboratorio)
    .where(eq(laboratorio.slug, LAB_SLUG))
    .limit(1);
  if (!lab) throw new Error(`No existe laboratorio con slug '${LAB_SLUG}'`);

  const list = await adminClient.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (list.error) throw new Error(`listUsers failed: ${list.error.message}`);

  for (const demo of DEMO_USERS) {
    let userId = list.data.users.find((u) => u.email === demo.email)?.id;

    if (!userId) {
      const created = await adminClient.auth.admin.createUser({
        email: demo.email,
        password: DEMO_PASSWORD,
        email_confirm: true,
        app_metadata: { role: demo.role },
      });
      if (created.error || !created.data.user) {
        throw new Error(`createUser(${demo.email}) failed: ${created.error?.message}`);
      }
      userId = created.data.user.id;
      console.log(`✓ ${demo.email} creado (${demo.role})`);
    } else {
      const updated = await adminClient.auth.admin.updateUserById(userId, {
        password: DEMO_PASSWORD,
        app_metadata: { role: demo.role },
      });
      if (updated.error) {
        throw new Error(`updateUser(${demo.email}) failed: ${updated.error.message}`);
      }
      console.log(`✓ ${demo.email} ya existía — password y rol reseteados (${demo.role})`);
    }

    await db
      .insert(user)
      .values({
        id: userId,
        labId: lab.id,
        email: demo.email,
        displayName: demo.displayName,
        role: demo.role,
        active: true,
      })
      .onConflictDoUpdate({
        target: user.id,
        set: { role: demo.role, active: true, labId: lab.id },
      });
  }

  console.log('');
  console.log(`Listo. ${DEMO_USERS.length} usuarios demo del lab '${LAB_SLUG}'.`);
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
