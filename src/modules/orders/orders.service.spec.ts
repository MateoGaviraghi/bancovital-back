import type { Order } from '@/db/schema';
import { ConflictException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { OrdersService } from './orders.service';

/**
 * Tests focalizados en la FSM y validaciones del service. La parte de
 * `create()` (transaccion + pricing + snapshots) se cubre end-to-end con
 * `pnpm smoke` contra Supabase real, porque mockear el QueryBuilder chainable
 * de Drizzle agrega mas peso de test que valor.
 */

const LAB_ID = 1;

function orderFixture(overrides: Partial<Order> = {}): Order {
  return {
    id: 1,
    labId: LAB_ID,
    servicioId: 1,
    customData: null,
    solicitanteAguaId: null,
    muestraAguaId: null,
    protocolNumber: 100,
    patientId: 1,
    animalPatientId: null,
    veterinarioId: null,
    insurerId: 1,
    insuranceAffiliateNumber: null,
    referringDoctorId: null,
    referringDoctorName: null,
    referringDoctorMp: null,
    diagnosis: null,
    origin: 'ambulatorio',
    orderDate: new Date(),
    status: 'borrador',
    isUrgent: false,
    notes: null,
    cancellationReason: null,
    totalParticular: '0.00',
    totalInsurer: '0.00',
    totalPatientCopay: '0.00',
    ubValueUsed: '1000.00',
    pdfReportPath: null,
    pdfReportIssuedAt: null,
    pdfReportRenderedAt: null,
    pdfReportSignedBy: null,
    createdBy: 'user-uuid',
    esExcedente: false,
    publicReportToken: null,
    publicAccessAttempts: 0,
    publicAccessLockedUntil: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

interface FakeDbState {
  currentOrder: Order;
  lineCount: number;
  joinResult: unknown[];
  // Cantidad de resultados cargados en practicas reportables. Gobierna el guard
  // assertHasReportableResults() que finalize() corre antes de la transicion.
  // Default 1 (>0) para no romper los tests de FSM que no testean ese guard.
  resultCount?: number;
}

function makeDb(state: FakeDbState) {
  const updateChain = {
    set: (patch: Partial<Order>) => ({
      where: () => ({
        returning: () =>
          Promise.resolve([{ ...state.currentOrder, ...patch, updatedAt: new Date() }]),
      }),
    }),
  };

  const buildSelectFrom = (selection?: Record<string, unknown>) => {
    const isCountSelection = selection !== undefined && 'lineCount' in selection;
    return {
      where: () => ({
        limit: () => Promise.resolve(isCountSelection ? [] : [state.currentOrder]),
      }),
      innerJoin: () => ({
        innerJoin: () => ({
          where: () => ({
            limit: () => Promise.resolve(state.joinResult),
          }),
        }),
      }),
    };
  };

  return {
    select: jest.fn().mockImplementation((selection?: Record<string, unknown>) => {
      const isCountSelection = selection !== undefined && 'lineCount' in selection;
      if (isCountSelection) {
        return {
          from: () => ({
            where: () => Promise.resolve([{ lineCount: state.lineCount }]),
          }),
        };
      }
      // assertHasReportableResults(): SELECT count(*) FROM result
      //   INNER JOIN order_practice ... WHERE ...  -> [{ resultCount }]
      const isResultCountSelection = selection !== undefined && 'resultCount' in selection;
      if (isResultCountSelection) {
        return {
          from: () => ({
            innerJoin: () => ({
              where: () => Promise.resolve([{ resultCount: state.resultCount ?? 1 }]),
            }),
          }),
        };
      }
      return { from: () => buildSelectFrom(selection) };
    }),
    update: jest.fn().mockReturnValue(updateChain),
  };
}

const CONSUMO_STUB = {
  registrarOrden: jest.fn().mockResolvedValue({ esExcedente: false }),
  getOrCreateCiclo: jest.fn(),
  periodoActual: jest.fn().mockReturnValue('2026-06'),
} as never;

const STORAGE_STUB = {
  storage: {
    from: jest.fn().mockReturnValue({
      remove: jest.fn().mockResolvedValue({ data: null, error: null }),
      upload: jest.fn().mockResolvedValue({ data: null, error: null }),
    }),
  },
} as never;

function makeService(state: FakeDbState): OrdersService {
  return new OrdersService(makeDb(state) as never, STORAGE_STUB, CONSUMO_STUB);
}

describe('OrdersService FSM (confirm/start/finalize/cancel/markEmitted)', () => {
  describe('confirm', () => {
    it('permite borrador -> confirmada cuando hay lineas', async () => {
      const service = makeService({
        currentOrder: orderFixture({ status: 'borrador' }),
        lineCount: 2,
        joinResult: [],
      });
      const r = await service.confirm(LAB_ID, 1);
      expect(r.status).toBe('confirmada');
    });

    it('rechaza confirm sin practicas (422)', async () => {
      const service = makeService({
        currentOrder: orderFixture({ status: 'borrador' }),
        lineCount: 0,
        joinResult: [],
      });
      await expect(service.confirm(LAB_ID, 1)).rejects.toThrow(UnprocessableEntityException);
    });

    it('rechaza confirm desde estado distinto a borrador (409)', async () => {
      const service = makeService({
        currentOrder: orderFixture({ status: 'confirmada' }),
        lineCount: 2,
        joinResult: [],
      });
      await expect(service.confirm(LAB_ID, 1)).rejects.toThrow(ConflictException);
    });
  });

  describe('start', () => {
    it('permite confirmada -> en_proceso', async () => {
      const service = makeService({
        currentOrder: orderFixture({ status: 'confirmada' }),
        lineCount: 2,
        joinResult: [],
      });
      const r = await service.start(LAB_ID, 1);
      expect(r.status).toBe('en_proceso');
    });

    it('rechaza start desde borrador (debe confirmar primero)', async () => {
      const service = makeService({
        currentOrder: orderFixture({ status: 'borrador' }),
        lineCount: 2,
        joinResult: [],
      });
      await expect(service.start(LAB_ID, 1)).rejects.toThrow(ConflictException);
    });
  });

  describe('finalize', () => {
    it('permite en_proceso -> resultados_cargados cuando hay resultados reportables', async () => {
      const service = makeService({
        currentOrder: orderFixture({ status: 'en_proceso' }),
        lineCount: 2,
        joinResult: [],
        resultCount: 1,
      });
      const r = await service.finalize(LAB_ID, 1);
      expect(r.status).toBe('resultados_cargados');
    });

    it('rechaza finalize si no hay resultados cargados en practicas reportables (422)', async () => {
      const service = makeService({
        currentOrder: orderFixture({ status: 'en_proceso' }),
        lineCount: 2,
        joinResult: [],
        resultCount: 0,
      });
      await expect(service.finalize(LAB_ID, 1)).rejects.toThrow(UnprocessableEntityException);
    });

    it('rechaza finalize desde confirmada (salto invalido)', async () => {
      const service = makeService({
        currentOrder: orderFixture({ status: 'confirmada' }),
        lineCount: 2,
        joinResult: [],
      });
      await expect(service.finalize(LAB_ID, 1)).rejects.toThrow(ConflictException);
    });
  });

  describe('cancel', () => {
    it('permite cancel desde borrador con razon', async () => {
      const service = makeService({
        currentOrder: orderFixture({ status: 'borrador' }),
        lineCount: 0,
        joinResult: [],
      });
      const r = await service.cancel(LAB_ID, 1, { reason: 'paciente no se presento' });
      expect(r.status).toBe('anulada');
      expect(r.cancellationReason).toBe('paciente no se presento');
    });

    it('permite cancel desde emitida', async () => {
      const service = makeService({
        currentOrder: orderFixture({ status: 'emitida' }),
        lineCount: 5,
        joinResult: [],
      });
      const r = await service.cancel(LAB_ID, 1, {});
      expect(r.status).toBe('anulada');
    });

    it('rechaza cancel desde entregada (terminal)', async () => {
      const service = makeService({
        currentOrder: orderFixture({ status: 'entregada' }),
        lineCount: 5,
        joinResult: [],
      });
      await expect(service.cancel(LAB_ID, 1, {})).rejects.toThrow(ConflictException);
    });

    it('rechaza cancel desde anulada (idempotencia)', async () => {
      const service = makeService({
        currentOrder: orderFixture({ status: 'anulada' }),
        lineCount: 5,
        joinResult: [],
      });
      await expect(service.cancel(LAB_ID, 1, {})).rejects.toThrow(ConflictException);
    });
  });

  describe('markEmitted', () => {
    it('permite resultados_cargados -> emitida con metadata de PDF', async () => {
      const service = makeService({
        currentOrder: orderFixture({ status: 'resultados_cargados' }),
        lineCount: 5,
        joinResult: [],
      });
      const r = await service.markEmitted(LAB_ID, 1, 'reports/1/100.pdf', 'signer-uuid');
      expect(r.status).toBe('emitida');
      expect(r.pdfReportPath).toBe('reports/1/100.pdf');
      expect(r.pdfReportSignedBy).toBe('signer-uuid');
    });
  });

  describe('byId', () => {
    it('lanza NotFoundException si la orden no existe', async () => {
      const service = makeService({
        currentOrder: orderFixture(),
        lineCount: 0,
        joinResult: [],
      });
      await expect(service.byId(LAB_ID, 999)).rejects.toThrow(NotFoundException);
    });

    it('devuelve la orden + paciente + insurer del JOIN', async () => {
      const service = makeService({
        currentOrder: orderFixture(),
        lineCount: 0,
        joinResult: [
          {
            order: orderFixture({ id: 42 }),
            patientId: 7,
            patientFirstName: 'Ada',
            patientLastName: 'Lovelace',
            patientDni: '30111222',
            insurerId: 3,
            insurerCode: 'IAPOS',
            insurerName: 'IAPOS',
          },
        ],
      });
      const r = await service.byId(LAB_ID, 42);
      expect(r.id).toBe(42);
      expect(r.patient?.dni).toBe('30111222');
      expect(r.insurer?.code).toBe('IAPOS');
    });
  });
});
