/**
 * Smoke test end-to-end. Crea (o recupera) un user admin en Supabase Auth,
 * obtiene un access_token, y prueba los endpoints REST contra un server local.
 *
 * Uso: levanta el server con `pnpm start:prod` en otra terminal, despues:
 *   pnpm smoke
 *
 * NO destruye nada del DB; los pacientes que crea quedan con dni "SMOKE..."
 * y se pueden borrar manualmente si molestan.
 */
import 'dotenv/config';
import { closeDb, getDb } from '@/db/client';
import { laboratorio, user } from '@/db/schema';
import { createClient } from '@supabase/supabase-js';

const API = process.env.API_URL ?? 'http://localhost:4000/api';
const SMOKE_EMAIL = 'smoke-admin@laboratorio.test';
const SMOKE_PASSWORD = 'SmokeAdmin!2026';

async function ensureSmokeUser(): Promise<string> {
  const adminClient = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const list = await adminClient.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (list.error) throw new Error(`listUsers failed: ${list.error.message}`);
  let userId = list.data.users.find((u) => u.email === SMOKE_EMAIL)?.id;

  if (!userId) {
    const created = await adminClient.auth.admin.createUser({
      email: SMOKE_EMAIL,
      password: SMOKE_PASSWORD,
      email_confirm: true,
      app_metadata: { role: 'admin' },
    });
    if (created.error || !created.data.user) {
      throw new Error(`createUser failed: ${created.error?.message ?? 'unknown'}`);
    }
    userId = created.data.user.id;
    console.log(`Created smoke user ${SMOKE_EMAIL} (id=${userId}).`);
  } else {
    await adminClient.auth.admin.updateUserById(userId, {
      app_metadata: { role: 'admin' },
    });
  }

  const db = getDb();
  const [lab] = await db.select().from(laboratorio).limit(1);
  if (!lab) throw new Error('No laboratorio found — run pnpm seed first');
  await db
    .insert(user)
    .values({
      id: userId,
      labId: lab.id,
      email: SMOKE_EMAIL,
      displayName: 'Smoke Admin',
      role: 'admin',
      active: true,
    })
    .onConflictDoNothing({ target: user.id });

  return userId;
}

async function getAccessToken(): Promise<string> {
  const anon = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await anon.auth.signInWithPassword({
    email: SMOKE_EMAIL,
    password: SMOKE_PASSWORD,
  });
  if (error || !data.session) {
    throw new Error(`signIn failed: ${error?.message ?? 'unknown'}`);
  }
  return data.session.access_token;
}

interface CallResult {
  step: string;
  ok: boolean;
  status: number;
  body: unknown;
}

async function call(
  step: string,
  method: string,
  path: string,
  token: string,
  body?: unknown,
  expectStatus?: number,
): Promise<CallResult> {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let parsed: unknown = text;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    // keep raw
  }
  const ok = expectStatus !== undefined ? res.status === expectStatus : res.ok;
  return { step, ok, status: res.status, body: parsed };
}

function pp(r: CallResult): void {
  const tag = r.ok ? 'OK' : 'FAIL';
  console.log(`[${tag}] ${r.step} -> ${r.status}`);
  if (!r.ok) console.log('  body:', JSON.stringify(r.body));
}

async function main() {
  const smokeUserId = await ensureSmokeUser();
  const token = await getAccessToken();
  console.log('Token obtained, running checks...\n');

  const results: CallResult[] = [];

  results.push(await call('GET /me', 'GET', '/me', token));
  results.push(await call('GET /lab-config', 'GET', '/lab-config', token));
  results.push(await call('GET /insurers', 'GET', '/insurers', token));
  results.push(await call('GET /insurers/with-ub', 'GET', '/insurers/with-ub', token));
  results.push(await call('GET /practices', 'GET', '/practices?q=', token));
  results.push(await call('GET /patients (no q)', 'GET', '/patients', token));
  results.push(await call('GET /doctors (no q)', 'GET', '/doctors', token));

  const smokeDni = `SMOKE-${Date.now().toString().slice(-6)}`;
  const createPatient = await call('POST /patients', 'POST', '/patients', token, {
    dni: smokeDni,
    firstName: 'Smoke',
    lastName: 'Tester',
    sex: 'F',
    birthDate: '1990-06-15',
    phone: '342000000',
  });
  results.push(createPatient);
  let patientId: number | undefined;
  if (createPatient.ok && typeof createPatient.body === 'object' && createPatient.body) {
    patientId = (createPatient.body as { id: number }).id;
  }

  if (patientId) {
    results.push(
      await call('PATCH /patients/:id', 'PATCH', `/patients/${patientId}`, token, {
        city: 'Santa Fe',
      }),
    );
    results.push(await call('GET /patients?q=DNI', 'GET', `/patients?q=${smokeDni}`, token));
  }

  const iapos = (results[2].body as Array<{ id: number; code: string }>).find(
    (i) => i.code === 'IAPOS',
  );
  if (iapos) {
    results.push(
      await call('POST /insurers/ub-values (IAPOS=1742.50)', 'POST', '/insurers/ub-values', token, {
        insurerId: iapos.id,
        value: '1742.50',
        validFrom: '2026-01-01',
        notes: 'smoke test',
      }),
    );
    results.push(
      await call('GET /insurers/:id/ub-history', 'GET', `/insurers/${iapos.id}/ub-history`, token),
    );
  }

  const particular = (results[2].body as Array<{ id: number; code: string }>).find(
    (i) => i.code === 'PARTICULAR',
  );
  if (particular) {
    results.push(
      await call(
        'POST /insurers/ub-values (PARTICULAR=2000.00)',
        'POST',
        '/insurers/ub-values',
        token,
        {
          insurerId: particular.id,
          value: '2000.00',
          validFrom: '2026-01-01',
        },
      ),
    );
  }

  // === Orders flow ===
  let orderId: number | undefined;
  if (patientId && iapos) {
    const practicesResp = await call('GET /practices (catalog)', 'GET', '/practices', token);
    results.push(practicesResp);
    const practices = Array.isArray(practicesResp.body)
      ? (practicesResp.body as Array<{ id: number }>)
      : [];

    if (practices.length === 0) {
      console.log('  (no practices in catalog -- skipping orders flow)');
    } else {
      const practiceIds = practices.slice(0, 2).map((p) => ({ practiceId: p.id }));
      const createOrder = await call('POST /orders (IAPOS, urgente)', 'POST', '/orders', token, {
        patientId,
        insurerId: iapos.id,
        origin: 'ambulatorio',
        isUrgent: true,
        diagnosis: 'Smoke test diagnostico',
        practices: practiceIds,
      });
      results.push(createOrder);
      if (createOrder.ok) {
        orderId = (createOrder.body as { order: { id: number } }).order.id;

        results.push(await call('GET /orders/:id', 'GET', `/orders/${orderId}`, token));
        const linesResp = await call(
          'GET /orders/:id/lines',
          'GET',
          `/orders/${orderId}/lines`,
          token,
        );
        results.push(linesResp);
        results.push(
          await call('PATCH /orders/:id/confirm', 'PATCH', `/orders/${orderId}/confirm`, token),
        );
        results.push(
          await call('PATCH /orders/:id/start', 'PATCH', `/orders/${orderId}/start`, token),
        );

        // === Results flow ===
        results.push(
          await call(
            'GET /orders/:id/results (hidrata rangos)',
            'GET',
            `/orders/${orderId}/results`,
            token,
          ),
        );
        const lines = Array.isArray(linesResp.body)
          ? (linesResp.body as Array<{
              id: number;
              practiceId: number | null;
              nbuCodeSnapshot: string;
            }>)
          : [];
        // Glucemia line (NBU 0301) tiene reference template -> debe clasificar.
        const glucoLine = lines.find((l) => l.practiceId !== null && l.nbuCodeSnapshot === '0301');
        if (glucoLine) {
          results.push(
            await call('POST /results (glucemia=95 -> normal)', 'POST', '/results', token, {
              orderPracticeId: glucoLine.id,
              valueNumeric: '95',
              unit: 'mg/dL',
            }),
          );
          results.push(
            await call(
              'POST /results (upsert -> glucemia=180 -> high)',
              'POST',
              '/results',
              token,
              {
                orderPracticeId: glucoLine.id,
                valueNumeric: '180',
                unit: 'mg/dL',
              },
            ),
          );
        }
        const otherLine = lines.find((l) => l.practiceId !== null && l.nbuCodeSnapshot !== '0301');
        if (otherLine) {
          results.push(
            await call('POST /results (texto libre, sin flag)', 'POST', '/results', token, {
              orderPracticeId: otherLine.id,
              valueText: 'POSITIVO',
            }),
          );
        }
        // Synthetic line (Acto bioquimico) debe rechazar 409
        const syntheticLine = lines.find((l) => l.practiceId === null);
        if (syntheticLine) {
          results.push(
            await call(
              'POST /results (synthetic -> 409)',
              'POST',
              '/results',
              token,
              { orderPracticeId: syntheticLine.id, valueNumeric: '1' },
              409,
            ),
          );
        }
        results.push(
          await call(
            'GET /orders/:id/results (resultados cargados)',
            'GET',
            `/orders/${orderId}/results`,
            token,
          ),
        );

        results.push(
          await call('PATCH /orders/:id/finalize', 'PATCH', `/orders/${orderId}/finalize`, token),
        );
        results.push(
          await call(
            'PATCH /orders/:id/confirm (esperando 409 FSM)',
            'PATCH',
            `/orders/${orderId}/confirm`,
            token,
            undefined,
            409,
          ),
        );

        // === Reports flow (Fase 8) ===
        results.push(
          await call('POST /reports/:orderId/emit', 'POST', `/reports/${orderId}/emit`, token),
        );
        results.push(
          await call(
            'GET /reports/:orderId/signed-url?ttlSeconds=300',
            'GET',
            `/reports/${orderId}/signed-url?ttlSeconds=300`,
            token,
          ),
        );
        results.push(
          await call(
            'POST /reports/:orderId/emit (esperando 409 - ya emitida)',
            'POST',
            `/reports/${orderId}/emit`,
            token,
            undefined,
            409,
          ),
        );
        results.push(
          await call(
            'GET /orders (filtro status=emitida)',
            'GET',
            '/orders?status=emitida&limit=5',
            token,
          ),
        );

        // === Users flow (Fase 9) — self-demotion / self-deactivation ===
        results.push(await call('GET /users', 'GET', '/users', token));
        results.push(
          await call(
            'PATCH /users/:self/role admin (no-op)',
            'PATCH',
            `/users/${smokeUserId}/role`,
            token,
            {
              role: 'admin',
            },
          ),
        );
        results.push(
          await call(
            'PATCH /users/:self/role recepcion (esperando 409 self-demotion)',
            'PATCH',
            `/users/${smokeUserId}/role`,
            token,
            { role: 'recepcion' },
            409,
          ),
        );
        results.push(
          await call(
            'PATCH /users/:self/active=false (esperando 409 self-deactivation)',
            'PATCH',
            `/users/${smokeUserId}/active`,
            token,
            { active: false },
            409,
          ),
        );
        results.push(
          await call(
            'PATCH /users/:self/active=true (no-op)',
            'PATCH',
            `/users/${smokeUserId}/active`,
            token,
            {
              active: true,
            },
          ),
        );
      }
    }
  }

  console.log('\n--- Results ---');
  for (const r of results) pp(r);

  const failed = results.filter((r) => !r.ok);
  if (failed.length > 0) {
    console.log(`\n${failed.length} step(s) failed.`);
    process.exit(1);
  } else {
    console.log('\nAll smoke checks passed.');
  }
}

main()
  .then(async () => {
    await closeDb();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error('Smoke run error:', err);
    await closeDb();
    process.exit(1);
  });
