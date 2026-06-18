import { NotFoundException } from '@nestjs/common';
import { SuperService } from './super.service';

type LabRow = { id: number; logoPath: string | null; primaryColor: string | null };

/**
 * Mock de DB para SuperService.onboarding.
 * Secuencia de select():
 *  1. findOne(lab)        → .from().where().limit()
 *  2. suscripcion activa  → .from().where().limit()
 *  3. count usuarios      → .from().where()  (devuelve [{ total }])
 *  4. count órdenes       → .from().where()  (devuelve [{ total }])
 */
function makeDb(state: {
  lab: LabRow | null;
  suscripcionActiva: boolean;
  usuariosActivos: number;
  ordenes: number;
}) {
  let call = 0;
  return {
    select: () => {
      call += 1;
      if (call === 1) {
        return {
          from: () => ({
            where: () => ({ limit: () => Promise.resolve(state.lab ? [state.lab] : []) }),
          }),
        };
      }
      if (call === 2) {
        return {
          from: () => ({
            where: () => ({
              limit: () => Promise.resolve(state.suscripcionActiva ? [{ id: 1 }] : []),
            }),
          }),
        };
      }
      if (call === 3) {
        return {
          from: () => ({ where: () => Promise.resolve([{ total: state.usuariosActivos }]) }),
        };
      }
      return {
        from: () => ({ where: () => Promise.resolve([{ total: state.ordenes }]) }),
      };
    },
  } as never;
}

const adminStub = {} as never;
const auditStub = { log: jest.fn() } as never;
const appConfigStub = { env: { APP_URL: 'http://localhost:3000' } } as never;

function makeService(db: unknown) {
  return new SuperService(db as never, adminStub, auditStub, appConfigStub);
}

describe('SuperService.onboarding', () => {
  it('lab sin nada → todos los items en false', async () => {
    const svc = makeService(
      makeDb({
        lab: { id: 1, logoPath: null, primaryColor: null },
        suscripcionActiva: false,
        usuariosActivos: 0,
        ordenes: 0,
      }),
    );
    const res = await svc.onboarding(1);

    expect(res.total).toBe(5);
    expect(res.completados).toBe(0);
    expect(res.items.every((i) => i.done === false)).toBe(true);
    expect(res.items.map((i) => i.key)).toEqual([
      'logo',
      'color',
      'plan',
      'usuarios',
      'primera_orden',
    ]);
  });

  it('lab completo → todos los items en true', async () => {
    const svc = makeService(
      makeDb({
        lab: { id: 1, logoPath: 'logos/1.png', primaryColor: '#0a5' },
        suscripcionActiva: true,
        usuariosActivos: 3,
        ordenes: 12,
      }),
    );
    const res = await svc.onboarding(1);

    expect(res.completados).toBe(5);
    expect(res.items.every((i) => i.done)).toBe(true);
  });

  it('lab parcial → cuenta solo los completados', async () => {
    const svc = makeService(
      makeDb({
        lab: { id: 1, logoPath: 'logos/1.png', primaryColor: null },
        suscripcionActiva: true,
        usuariosActivos: 1,
        ordenes: 0,
      }),
    );
    const res = await svc.onboarding(1);

    // logo ✓, color ✗, plan ✓, usuarios ✓, primera_orden ✗
    expect(res.completados).toBe(3);
    expect(res.items.find((i) => i.key === 'color')?.done).toBe(false);
    expect(res.items.find((i) => i.key === 'primera_orden')?.done).toBe(false);
  });

  it('lab inexistente → NotFoundException', async () => {
    const svc = makeService(
      makeDb({ lab: null, suscripcionActiva: false, usuariosActivos: 0, ordenes: 0 }),
    );
    await expect(svc.onboarding(999)).rejects.toBeInstanceOf(NotFoundException);
  });
});
