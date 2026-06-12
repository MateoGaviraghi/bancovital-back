import { ConsumoService } from './consumo.service';

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

type CicloRow = {
  id: number;
  labId: number;
  periodo: string;
  cupoBase: number | null;
  rollover: number;
  usadas: number;
  excedentes: number;
  createdAt: Date;
  updatedAt: Date;
};

function makeCiclo(overrides: Partial<CicloRow> = {}): CicloRow {
  return {
    id: 1,
    labId: 1,
    periodo: '2026-06',
    cupoBase: 100,
    rollover: 0,
    usadas: 0,
    excedentes: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

/**
 * Construye un mock de DB mínimo para las operaciones de consumo.
 * Simula el QueryBuilder de Drizzle.
 */
function makeDb(state: {
  cicloActual?: CicloRow | null;
  cicloAnterior?: CicloRow | null;
  suscripcion?: { planId: number } | null;
  planRow?: {
    cupoOrdenesMes: number;
    id: number;
    nombre: string;
    precioOrdenExcedente: string;
  } | null;
}) {
  const selectChain = (rows: unknown[]) => ({
    from: () => ({
      where: () => ({
        limit: () => Promise.resolve(rows),
      }),
    }),
  });

  const updateChain = (retorno: CicloRow) => ({
    set: () => ({
      where: () => ({
        returning: () => Promise.resolve([retorno]),
      }),
    }),
  });

  const insertChain = (retorno: CicloRow | null) => ({
    values: () => ({
      onConflictDoNothing: () => ({
        returning: () => Promise.resolve(retorno ? [retorno] : []),
      }),
    }),
  });

  let callCount = 0;

  return {
    select: jest.fn().mockImplementation(() => {
      callCount++;
      // 1ra llamada: ciclo actual
      // 2da llamada: ciclo anterior (si no existía el actual)
      // 3ra: suscripción; 4ta: plan
      const rows: unknown[] = [];
      if (callCount === 1) {
        if (state.cicloActual !== null && state.cicloActual !== undefined)
          rows.push(state.cicloActual);
      } else if (callCount === 2) {
        if (state.cicloAnterior !== null && state.cicloAnterior !== undefined)
          rows.push(state.cicloAnterior);
      } else if (callCount === 3) {
        if (state.suscripcion) rows.push(state.suscripcion);
      } else if (callCount === 4) {
        if (state.planRow) rows.push(state.planRow);
      }
      return {
        from: () => ({
          where: () => ({
            limit: () => Promise.resolve(rows),
          }),
        }),
      };
    }),
    insert: jest
      .fn()
      .mockImplementation(() =>
        insertChain(
          state.cicloActual ?? makeCiclo({ cupoBase: state.planRow?.cupoOrdenesMes ?? null }),
        ),
      ),
    update: jest.fn().mockImplementation(() => updateChain(state.cicloActual ?? makeCiclo())),
    transaction: jest.fn(),
  };
}

// ─────────────────────────────────────────────────────────────
// Tests: cálculo de rollover (método privado accedido vía cast)
// ─────────────────────────────────────────────────────────────

type AnteriorArg = { cupoBase: number | null; usadas: number; rollover: number } | undefined;

describe('ConsumoService — cálculo de rollover', () => {
  // Accedemos al método privado a través del prototype
  const service = new ConsumoService(null as never);
  // biome-ignore lint/suspicious/noExplicitAny: acceso a método privado para test
  const calc = (anterior: AnteriorArg) => (service as any).calcularRollover(anterior);

  it('retorna 0 cuando no hay ciclo anterior', () => {
    expect(calc(undefined)).toBe(0);
  });

  it('retorna 0 cuando el ciclo anterior no tiene plan (cupoBase=null)', () => {
    expect(calc({ cupoBase: null, usadas: 0, rollover: 0 })).toBe(0);
  });

  it('retorna el sobrante cuando usadas < cupoBase (rollover simple)', () => {
    // cupoBase=100, usadas=70, rollover anterior=0 → sobrante=30
    expect(calc({ cupoBase: 100, usadas: 70, rollover: 0 })).toBe(30);
  });

  it('consumo rollover-first: sobrante se calcula sobre cupoBase, no cupoBase+rollover', () => {
    // cupoBase=100, usadas=110, rolloverAnterior=20
    // Parámetros: usadas=110, rolloverAnterior=20
    // max(0, 110 - 20) = 90 consumido del cupo base
    // sobrante = max(0, 100 - 90) = 10
    expect(calc({ cupoBase: 100, usadas: 110, rollover: 20 })).toBe(10);
  });

  it('retorna 0 cuando se usó todo el cupo (sin sobrante)', () => {
    expect(calc({ cupoBase: 100, usadas: 100, rollover: 0 })).toBe(0);
  });

  it('el rollover NO se encadena: si anterior tiene rollover no usado, vence', () => {
    // cupoBase=100, usadas=0, rollover=50 del período anterior
    // sobrante = max(0, 100 - max(0, 0 - 50)) = max(0, 100 - 0) = 100
    // El rollover anterior YA VENCIÓ, no se arrastra — solo el cupoBase sobrante importa
    expect(calc({ cupoBase: 100, usadas: 0, rollover: 50 })).toBe(100);
  });

  it('retorna 0 cuando usadas > cupoBase incluso con rollover anterior (excedentes no generan rollover)', () => {
    // cupoBase=100, usadas=150, rollover anterior=0 → usó todo, sin sobrante
    expect(calc({ cupoBase: 100, usadas: 150, rollover: 0 })).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────
// Tests: registrarOrden
// ─────────────────────────────────────────────────────────────

describe('ConsumoService — registrarOrden', () => {
  function makeServiceWithCiclo(ciclo: CicloRow) {
    // Simula una tx que devuelve el ciclo actualizado con usadas+1
    const updatedCiclo = { ...ciclo, usadas: ciclo.usadas + 1 };
    const tx = {
      update: jest.fn().mockReturnValue({
        set: () => ({
          where: () => ({
            returning: () => Promise.resolve([updatedCiclo]),
          }),
        }),
      }),
      insert: jest.fn().mockReturnValue({
        values: () => ({
          onConflictDoNothing: () => ({
            returning: () => Promise.resolve([ciclo]),
          }),
        }),
      }),
      select: jest.fn().mockReturnValue({
        from: () => ({
          where: () => ({
            limit: () => Promise.resolve([ciclo]),
          }),
        }),
      }),
    };

    // El service necesita DB pero registrarOrden recibe tx directamente
    const svc = new ConsumoService({ transaction: jest.fn() } as never);
    return { svc, tx };
  }

  it('dentro de cupo: no es excedente', async () => {
    const ciclo = makeCiclo({ cupoBase: 100, rollover: 0, usadas: 49 });
    // Tras update: usadas=50, cupoEfectivo=100 → no excede
    const { svc, tx } = makeServiceWithCiclo(ciclo);
    const result = await svc.registrarOrden(1, tx as never);
    expect(result.esExcedente).toBe(false);
  });

  it('exactamente en el límite: no es excedente', async () => {
    const ciclo = makeCiclo({ cupoBase: 100, rollover: 0, usadas: 99 });
    // Tras update: usadas=100 = cupoEfectivo=100 → no excede
    const { svc, tx } = makeServiceWithCiclo(ciclo);
    const result = await svc.registrarOrden(1, tx as never);
    expect(result.esExcedente).toBe(false);
  });

  it('supera el cupo: es excedente', async () => {
    const ciclo = makeCiclo({ cupoBase: 100, rollover: 0, usadas: 100 });
    // Tras update: usadas=101 > cupoEfectivo=100 → es excedente
    const { svc, tx } = makeServiceWithCiclo(ciclo);

    // Hacemos que el segundo update (excedentes) también resuelva
    tx.update = jest.fn().mockReturnValue({
      set: () => ({
        where: () => ({
          returning: () => Promise.resolve([{ ...ciclo, usadas: 101, excedentes: 1 }]),
        }),
      }),
    });

    const result = await svc.registrarOrden(1, tx as never);
    expect(result.esExcedente).toBe(true);
  });

  it('sin plan (cupoBase=null): nunca es excedente', async () => {
    const ciclo = makeCiclo({ cupoBase: null, rollover: 0, usadas: 9999 });
    const { svc, tx } = makeServiceWithCiclo(ciclo);
    // El update devuelve usadas+1 con cupoBase=null
    tx.update = jest.fn().mockReturnValue({
      set: () => ({
        where: () => ({
          returning: () => Promise.resolve([{ ...ciclo, usadas: 10000 }]),
        }),
      }),
    });
    const result = await svc.registrarOrden(1, tx as never);
    expect(result.esExcedente).toBe(false);
  });

  it('con rollover: usa cupoBase+rollover como límite', async () => {
    // cupoBase=100, rollover=20 → cupoEfectivo=120
    const ciclo = makeCiclo({ cupoBase: 100, rollover: 20, usadas: 119 });
    // Tras update: usadas=120 = cupoEfectivo=120 → no excede
    const { svc, tx } = makeServiceWithCiclo(ciclo);
    const result = await svc.registrarOrden(1, tx as never);
    expect(result.esExcedente).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────
// Test: periodoActual devuelve formato correcto
// ─────────────────────────────────────────────────────────────

describe('ConsumoService — periodoActual', () => {
  it('devuelve formato YYYY-MM', () => {
    const svc = new ConsumoService(null as never);
    const periodo = svc.periodoActual();
    expect(periodo).toMatch(/^\d{4}-\d{2}$/);
  });
});
