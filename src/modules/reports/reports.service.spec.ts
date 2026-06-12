import type { Order } from '@/db/schema';
import type { OrdersService } from '@/modules/orders/orders.service';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { getTableName } from 'drizzle-orm';

// @react-pdf/renderer es ESM. Para tests unitarios de validacion de estado no
// renderizamos PDFs de verdad: mockeamos render.tsx que es lo que importa el service.
jest.mock('@/pdf/render', () => ({
  renderInformePdf: jest.fn().mockResolvedValue(Buffer.from('%PDF-1.4 fake')),
}));

import { ReportsService, buildPdfPath } from './reports.service';

const LAB_ID = 1;

describe('buildPdfPath', () => {
  it('arma {labId}/{orderId}/{protocol con padding a 8 digitos}.pdf', () => {
    expect(buildPdfPath(1, 42, 11)).toBe('1/42/00000011.pdf');
    expect(buildPdfPath(2, 1, 99999999)).toBe('2/1/99999999.pdf');
    expect(buildPdfPath(1, 123, 0)).toBe('1/123/00000000.pdf');
  });
});

function orderFixture(overrides: Partial<Order> = {}): Order {
  return {
    id: 1,
    labId: LAB_ID,
    protocolNumber: 11,
    patientId: 1,
    insurerId: 1,
    insuranceAffiliateNumber: null,
    referringDoctorId: null,
    referringDoctorName: null,
    referringDoctorMp: null,
    diagnosis: null,
    origin: 'ambulatorio',
    orderDate: new Date(),
    status: 'resultados_cargados',
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
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeService(currentOrder: Order): ReportsService {
  const db = {
    select: jest.fn().mockImplementation(() => ({
      from: (table: unknown) => {
        let name: string;
        try {
          name = getTableName(table as never);
        } catch {
          name = '';
        }
        return {
          where: () => ({
            limit: () => {
              if (name === 'order') return Promise.resolve([currentOrder]);
              return Promise.resolve([]);
            },
          }),
          orderBy: () => Promise.resolve([]),
        };
      },
    })),
  };
  const storage = {
    storage: {
      from: jest.fn(),
    },
  };
  const orders = {} as OrdersService;
  return new ReportsService(db as never, storage as never, orders);
}

describe('ReportsService.emit validacion de estado', () => {
  it('rechaza emit si la orden no esta en resultados_cargados', async () => {
    const service = makeService(orderFixture({ status: 'borrador' }));
    await expect(service.emit(LAB_ID, 1, 'u')).rejects.toThrow(ConflictException);
  });

  it('rechaza emit si la orden ya esta emitida', async () => {
    const service = makeService(orderFixture({ status: 'emitida' }));
    await expect(service.emit(LAB_ID, 1, 'u')).rejects.toThrow(ConflictException);
  });

  it('rechaza emit si la orden no existe', async () => {
    const db = {
      select: () => ({
        from: () => ({ where: () => ({ limit: () => Promise.resolve([]) }) }),
      }),
    };
    const service = new ReportsService(
      db as never,
      { storage: { from: jest.fn() } } as never,
      {} as OrdersService,
    );
    await expect(service.emit(LAB_ID, 999, 'u')).rejects.toThrow(NotFoundException);
  });
});

describe('ReportsService.signedUrl validacion de estado', () => {
  it('rechaza signedUrl si la orden no esta emitida ni entregada', async () => {
    const service = makeService(orderFixture({ status: 'en_proceso' }));
    await expect(service.signedUrl(LAB_ID, 1, 900)).rejects.toThrow(ConflictException);
  });

  it('rechaza signedUrl si la orden esta borrador', async () => {
    const service = makeService(orderFixture({ status: 'borrador' }));
    await expect(service.signedUrl(LAB_ID, 1, 900)).rejects.toThrow(ConflictException);
  });

  it('rechaza signedUrl si la orden no existe', async () => {
    const db = {
      select: () => ({
        from: () => ({ where: () => ({ limit: () => Promise.resolve([]) }) }),
      }),
    };
    const service = new ReportsService(
      db as never,
      { storage: { from: jest.fn() } } as never,
      {} as OrdersService,
    );
    await expect(service.signedUrl(LAB_ID, 999, 900)).rejects.toThrow(NotFoundException);
  });
});
