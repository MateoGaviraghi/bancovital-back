import { BillingService } from './billing.service';

type MovRow = {
  id: number;
  labId: number;
  tipo: 'cargo' | 'pago';
  monto: string;
  concepto: string;
  notas: string | null;
  fecha: Date;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
};

function makeMov(overrides: Partial<MovRow> = {}): MovRow {
  return {
    id: 1,
    labId: 1,
    tipo: 'cargo',
    monto: '100.00',
    concepto: 'concepto',
    notas: null,
    fecha: new Date('2026-06-01T00:00:00.000Z'),
    createdBy: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    ...overrides,
  };
}

/**
 * Mock de DB:
 * - 1ª llamada select() → assertLabExists (.from().where().limit())
 * - 2ª llamada select() → movimientos (.from().where().orderBy())
 */
function makeDb(movimientos: MovRow[]) {
  let call = 0;
  return {
    select: () => {
      call += 1;
      if (call === 1) {
        // assertLabExists
        return {
          from: () => ({
            where: () => ({ limit: () => Promise.resolve([{ id: 1 }]) }),
          }),
        };
      }
      // movimientos
      return {
        from: () => ({
          where: () => ({ orderBy: () => Promise.resolve(movimientos) }),
        }),
      };
    },
  } as never;
}

const auditStub = { log: jest.fn() } as never;

describe('BillingService.getEstadoCuenta — balance con Decimal', () => {
  it('balance = sum(pagos) − sum(cargos)', async () => {
    const svc = new BillingService(
      makeDb([
        makeMov({ id: 1, tipo: 'cargo', monto: '15000.00' }),
        makeMov({ id: 2, tipo: 'pago', monto: '10000.00' }),
        makeMov({ id: 3, tipo: 'cargo', monto: '5000.50' }),
        makeMov({ id: 4, tipo: 'pago', monto: '2500.25' }),
      ]),
      auditStub,
    );

    const res = await svc.getEstadoCuenta(1);

    // pagos = 12500.25 ; cargos = 20000.50 ; balance = -7500.25
    expect(res.totalPagos).toBe(12500.25);
    expect(res.totalCargos).toBe(20000.5);
    expect(res.balance).toBe(-7500.25);
    expect(res.movimientos).toHaveLength(4);
  });

  it('evita el error de punto flotante de JS (0.1 + 0.2)', async () => {
    const svc = new BillingService(
      makeDb([
        makeMov({ id: 1, tipo: 'pago', monto: '0.10' }),
        makeMov({ id: 2, tipo: 'pago', monto: '0.20' }),
      ]),
      auditStub,
    );

    const res = await svc.getEstadoCuenta(1);
    // Con float nativo 0.1 + 0.2 = 0.30000000000000004; Decimal lo evita.
    expect(res.totalPagos).toBe(0.3);
    expect(res.balance).toBe(0.3);
  });

  it('balance 0 cuando no hay movimientos', async () => {
    const svc = new BillingService(makeDb([]), auditStub);
    const res = await svc.getEstadoCuenta(1);
    expect(res.balance).toBe(0);
    expect(res.totalPagos).toBe(0);
    expect(res.totalCargos).toBe(0);
    expect(res.movimientos).toHaveLength(0);
  });
});
