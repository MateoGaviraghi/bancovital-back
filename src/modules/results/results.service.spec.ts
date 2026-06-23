import type { OrderPractice, Patient, Practice } from '@/db/schema';
import type { ReferenceValueTemplate } from '@/domain/validation/validation';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { getTableName } from 'drizzle-orm';
import { ResultsService } from './results.service';

/**
 * Tests del flag automatico (con classifyResult) y validaciones de estado.
 * El upsert + byOrder real se cubre end-to-end con pnpm smoke.
 */

function lineFixture(overrides: Partial<OrderPractice> = {}): OrderPractice {
  return {
    id: 10,
    orderId: 1,
    practiceId: 100,
    nbuCodeSnapshot: '0301',
    nameSnapshot: 'Glucemia',
    unitsSnapshot: '1.50',
    ubValueSnapshot: '1000.00',
    priceParticular: '1500.00',
    priceInsurer: '1000.00',
    patientCopay: '0.00',
    authorizationStatus: 'no_aplica',
    authorizationCode: null,
    includeInReport: true,
    sortOrder: 0,
    createdAt: new Date(),
    ...overrides,
  };
}

function patientFixture(overrides: Partial<Patient> = {}): Pick<Patient, 'sex' | 'birthDate'> {
  return {
    sex: 'M',
    birthDate: new Date('1990-01-01'),
    ...overrides,
  };
}

function practiceFixture(template: ReferenceValueTemplate | null): Practice {
  return {
    id: 100,
    nbuCode: '0301',
    name: 'Glucemia',
    shortName: 'Gluc',
    category: 'quimica',
    section: 'quimica',
    units: '1.50',
    notes: null,
    requiresAuthorization: false,
    referenceValueTemplate: template,
    isSpecialAct: false,
    active: true,
    parentId: null,
    referenceValue: null,
    methodology: null,
    isElaborated: false,
    condicionVisibilidad: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

interface FakeState {
  line: OrderPractice | null;
  orderStatus: string;
  patient: Pick<Patient, 'sex' | 'birthDate'>;
  practice: Practice | null;
  existingResult: { id: number } | null;
}

function makeService(state: FakeState): ResultsService {
  const fromTable = (table: unknown): Promise<unknown[]> => {
    let name: string;
    try {
      name = getTableName(table as never);
    } catch {
      name = '';
    }
    if (name === 'order_practice') return Promise.resolve(state.line ? [state.line] : []);
    if (name === 'order')
      return Promise.resolve(
        state.line
          ? [{ id: state.line.orderId, status: state.orderStatus, patientId: 1, labId: 1 }]
          : [],
      );
    if (name === 'practice') return Promise.resolve(state.practice ? [state.practice] : []);
    if (name === 'patient') return Promise.resolve([state.patient]);
    if (name === 'result')
      return Promise.resolve(state.existingResult ? [state.existingResult] : []);
    return Promise.resolve([]);
  };

  const db = {
    select: jest.fn().mockImplementation(() => ({
      from: (table: unknown) => ({
        where: () => ({
          limit: () => fromTable(table),
        }),
      }),
    })),
    insert: jest.fn().mockImplementation(() => ({
      values: (vals: Record<string, unknown>) => ({
        returning: () =>
          Promise.resolve([
            { id: 99, ...vals, enteredAt: new Date(), reviewedBy: null, reviewedAt: null },
          ]),
      }),
    })),
    update: jest.fn().mockImplementation(() => ({
      set: (patch: Record<string, unknown>) => ({
        where: () => ({
          returning: () =>
            Promise.resolve([
              {
                id: state.existingResult?.id ?? 99,
                ...patch,
                reviewedBy: null,
                reviewedAt: null,
              },
            ]),
        }),
      }),
    })),
  };
  return new ResultsService(db as never);
}

const TEMPLATE_GLUCEMIA: ReferenceValueTemplate = {
  rules: [
    {
      band: { low: '70', high: '110', criticalLow: '40', criticalHigh: '300' },
    },
  ],
};

describe('ResultsService.upsert validaciones', () => {
  it('rechaza upsert sin valueNumeric ni valueText (400)', async () => {
    const service = makeService({
      line: lineFixture(),
      orderStatus: 'en_proceso',
      patient: patientFixture(),
      practice: practiceFixture(TEMPLATE_GLUCEMIA),
      existingResult: null,
    });
    await expect(service.upsert(1, { orderPracticeId: 10 } as never, 'u')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('rechaza upsert si la linea no existe (404)', async () => {
    const service = makeService({
      line: null,
      orderStatus: 'en_proceso',
      patient: patientFixture(),
      practice: null,
      existingResult: null,
    });
    await expect(
      service.upsert(1, { orderPracticeId: 999, valueNumeric: '90' }, 'u'),
    ).rejects.toThrow(NotFoundException);
  });

  it('rechaza upsert si la linea es synthetic (practiceId=null) (409)', async () => {
    const service = makeService({
      line: lineFixture({ practiceId: null }),
      orderStatus: 'en_proceso',
      patient: patientFixture(),
      practice: null,
      existingResult: null,
    });
    await expect(
      service.upsert(1, { orderPracticeId: 10, valueNumeric: '90' }, 'u'),
    ).rejects.toThrow(ConflictException);
  });

  it('permite upsert si la orden esta en borrador', async () => {
    const service = makeService({
      line: lineFixture(),
      orderStatus: 'borrador',
      patient: patientFixture(),
      practice: practiceFixture(TEMPLATE_GLUCEMIA),
      existingResult: null,
    });
    await expect(
      service.upsert(1, { orderPracticeId: 10, valueNumeric: '90' }, 'u'),
    ).resolves.toBeDefined();
  });

  it('rechaza upsert si la orden esta en entregada o anulada', async () => {
    for (const status of ['entregada', 'anulada', 'emitida']) {
      const service = makeService({
        line: lineFixture(),
        orderStatus: status,
        patient: patientFixture(),
        practice: practiceFixture(TEMPLATE_GLUCEMIA),
        existingResult: null,
      });
      await expect(
        service.upsert(1, { orderPracticeId: 10, valueNumeric: '90' }, 'u'),
      ).rejects.toThrow(ConflictException);
    }
  });
});

describe('ResultsService.upsert flag automatico', () => {
  it('valor normal -> flag=normal, rangos llenos', async () => {
    const service = makeService({
      line: lineFixture(),
      orderStatus: 'en_proceso',
      patient: patientFixture(),
      practice: practiceFixture(TEMPLATE_GLUCEMIA),
      existingResult: null,
    });
    const r = await service.upsert(1, { orderPracticeId: 10, valueNumeric: '95' }, 'u');
    expect(r.flag).toBe('normal');
    expect(r.referenceRangeLow).toBe('70');
    expect(r.referenceRangeHigh).toBe('110');
  });

  it('valor sobre el techo -> flag=high', async () => {
    const service = makeService({
      line: lineFixture(),
      orderStatus: 'en_proceso',
      patient: patientFixture(),
      practice: practiceFixture(TEMPLATE_GLUCEMIA),
      existingResult: null,
    });
    const r = await service.upsert(1, { orderPracticeId: 10, valueNumeric: '150' }, 'u');
    expect(r.flag).toBe('high');
  });

  it('valor sobre el critico alto -> flag=critical_high', async () => {
    const service = makeService({
      line: lineFixture(),
      orderStatus: 'en_proceso',
      patient: patientFixture(),
      practice: practiceFixture(TEMPLATE_GLUCEMIA),
      existingResult: null,
    });
    const r = await service.upsert(1, { orderPracticeId: 10, valueNumeric: '400' }, 'u');
    expect(r.flag).toBe('critical_high');
  });

  it('practice sin reference_value_template -> flag=null', async () => {
    const service = makeService({
      line: lineFixture(),
      orderStatus: 'en_proceso',
      patient: patientFixture(),
      practice: practiceFixture(null),
      existingResult: null,
    });
    const r = await service.upsert(1, { orderPracticeId: 10, valueNumeric: '90' }, 'u');
    expect(r.flag).toBeNull();
    expect(r.referenceRangeLow).toBeNull();
  });

  it('solo valueText -> flag=null, sin calculo', async () => {
    const service = makeService({
      line: lineFixture(),
      orderStatus: 'en_proceso',
      patient: patientFixture(),
      practice: practiceFixture(TEMPLATE_GLUCEMIA),
      existingResult: null,
    });
    const r = await service.upsert(1, { orderPracticeId: 10, valueText: 'POSITIVO' }, 'u');
    expect(r.flag).toBeNull();
    expect(r.valueText).toBe('POSITIVO');
  });

  it('UPDATE cuando ya existe result para la linea', async () => {
    const service = makeService({
      line: lineFixture(),
      orderStatus: 'resultados_cargados',
      patient: patientFixture(),
      practice: practiceFixture(TEMPLATE_GLUCEMIA),
      existingResult: { id: 77 },
    });
    const r = await service.upsert(1, { orderPracticeId: 10, valueNumeric: '85' }, 'u');
    expect(r.id).toBe(77);
    expect(r.flag).toBe('normal');
  });
});
