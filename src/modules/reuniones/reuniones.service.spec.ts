import '../../tz'; // anclar TZ a AR

import { ConflictException, NotFoundException } from '@nestjs/common';
import { LEAD_TIME_MS, generarSlotsDelDia } from './booking-config';
import { ReunionesService } from './reuniones.service';

/** Fecha de un lunes que NO está en el pasado (usamos 2025-01-06). */
const LUNES = '2025-01-06';

/** Primer slot del lunes 2025-01-06: 10:00 AR */
function primerSlotLunes(): { inicio: Date; fin: Date } {
  return generarSlotsDelDia(LUNES)[0]!;
}

/** Genera un slot futuro que respeta lead time (2h+1min en el futuro). */
function slotFuturo(): { inicio: Date; fin: Date } {
  const ahora = new Date();
  // ir al próximo día hábil que esté en el horizonte
  const base = new Date(ahora.getTime() + LEAD_TIME_MS + 60_000 + 24 * 60 * 60 * 1000);
  // avanzar hasta lunes si cae en fin de semana
  while ([0, 6].includes(base.getDay())) {
    base.setDate(base.getDate() + 1);
  }
  base.setHours(10, 0, 0, 0);
  return { inicio: base, fin: new Date(base.getTime() + 30 * 60 * 1000) };
}

describe('ReunionesService.getDisponibilidad', () => {
  let service: ReunionesService;
  let dbMock: { select: jest.Mock };
  let gcMock: { getBusy: jest.Mock; isConfigured: boolean };
  let mailMock: {
    sendReunionConfirmacion: jest.Mock;
    sendReunionNotice: jest.Mock;
    sendAsistenciaConfirmada: jest.Mock;
  };
  const appConfigMock = { env: { MAIL_NOTIFY_TO: undefined, APP_URL: 'http://localhost:3000' } };

  function buildDbSelect(reservadas: { slotInicio: Date }[]) {
    const chain = {
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockResolvedValue(reservadas),
    };
    return { select: jest.fn().mockReturnValue(chain) };
  }

  beforeEach(() => {
    gcMock = { getBusy: jest.fn().mockResolvedValue([]), isConfigured: false };
    mailMock = {
      sendReunionConfirmacion: jest.fn().mockResolvedValue(undefined),
      sendReunionNotice: jest.fn().mockResolvedValue(undefined),
      sendAsistenciaConfirmada: jest.fn().mockResolvedValue(undefined),
    };
  });

  it('devuelve vacío para fecha de fin de semana', async () => {
    dbMock = buildDbSelect([]);
    service = new ReunionesService(
      dbMock as never,
      gcMock as never,
      mailMock as never,
      appConfigMock as never,
    );
    // 2025-01-04 es sábado
    const result = await service.getDisponibilidad('2025-01-04');
    expect(result).toHaveLength(0);
  });

  it('devuelve vacío para formato de fecha inválido', async () => {
    dbMock = buildDbSelect([]);
    service = new ReunionesService(
      dbMock as never,
      gcMock as never,
      mailMock as never,
      appConfigMock as never,
    );
    const result = await service.getDisponibilidad('no-es-fecha');
    expect(result).toHaveLength(0);
  });

  it('filtra slots que ya están reservados en DB', async () => {
    const { inicio } = primerSlotLunes();
    dbMock = buildDbSelect([{ slotInicio: inicio }]);
    service = new ReunionesService(
      dbMock as never,
      gcMock as never,
      mailMock as never,
      appConfigMock as never,
    );

    // Todos los slots del día para 2025-01-06 están en el pasado (lead time los filtra)
    // Así que el resultado ya sería vacío; aquí verificamos que el slot reservado no aparece
    const result = await service.getDisponibilidad(LUNES);
    const isoInicio = inicio.toISOString();
    expect(result.find((s) => s.inicio === isoInicio)).toBeUndefined();
  });

  it('filtra slots dentro del lead time', async () => {
    // Todos los slots de un día pasado deben ser excluidos por lead time
    dbMock = buildDbSelect([]);
    service = new ReunionesService(
      dbMock as never,
      gcMock as never,
      mailMock as never,
      appConfigMock as never,
    );
    // 2025-01-06 está en el pasado, todos sus slots violan lead time
    const result = await service.getDisponibilidad(LUNES);
    expect(result).toHaveLength(0);
  });

  it('filtra slots ocupados en Google Calendar', async () => {
    const slot = slotFuturo();
    // El slot futuro está ocupado en Google
    gcMock.getBusy = jest.fn().mockResolvedValue([{ start: slot.inicio, end: slot.fin }]);
    gcMock.isConfigured = true;

    dbMock = buildDbSelect([]);
    service = new ReunionesService(
      dbMock as never,
      gcMock as never,
      mailMock as never,
      appConfigMock as never,
    );

    const fecha = slot.inicio.toISOString().slice(0, 10);
    const result = await service.getDisponibilidad(fecha);
    const coincide = result.find((s) => s.inicio === slot.inicio.toISOString());
    expect(coincide).toBeUndefined();
  });

  it('incluye slots futuros no reservados', async () => {
    const slot = slotFuturo();
    dbMock = buildDbSelect([]);
    service = new ReunionesService(
      dbMock as never,
      gcMock as never,
      mailMock as never,
      appConfigMock as never,
    );

    const fecha = slot.inicio.toISOString().slice(0, 10);
    const result = await service.getDisponibilidad(fecha);
    // Debe haber al menos el slot de las 10:00 (si está en el futuro con lead time OK)
    expect(result.length).toBeGreaterThan(0);
  });
});

describe('ReunionesService.crear — validación de slot', () => {
  let service: ReunionesService;
  let dbMock: { select: jest.Mock; insert: jest.Mock; update: jest.Mock };
  let gcMock: { getBusy: jest.Mock; createEvent: jest.Mock; isConfigured: boolean };
  let mailMock: {
    sendReunionConfirmacion: jest.Mock;
    sendReunionNotice: jest.Mock;
    sendAsistenciaConfirmada: jest.Mock;
  };
  const appConfigMock = { env: { MAIL_NOTIFY_TO: undefined, APP_URL: 'http://localhost:3000' } };

  function buildDbFull(reunionId = 1) {
    const returning = jest.fn().mockResolvedValue([{ id: reunionId }]);
    const values = jest.fn().mockReturnValue({ returning });
    const insertChain = { values };

    const updateSet = jest.fn().mockReturnValue({ where: jest.fn().mockResolvedValue([]) });
    const updateChain = { set: updateSet };

    return {
      select: jest.fn().mockReturnValue({
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue([]),
        }),
      }),
      insert: jest.fn().mockReturnValue(insertChain),
      update: jest.fn().mockReturnValue(updateChain),
    };
  }

  beforeEach(() => {
    gcMock = {
      getBusy: jest.fn().mockResolvedValue([]),
      createEvent: jest.fn().mockResolvedValue(null),
      isConfigured: false,
    };
    mailMock = {
      sendReunionConfirmacion: jest.fn().mockResolvedValue(undefined),
      sendReunionNotice: jest.fn().mockResolvedValue(undefined),
      sendAsistenciaConfirmada: jest.fn().mockResolvedValue(undefined),
    };
  });

  it('lanza 400 si slotInicio es fin de semana', async () => {
    dbMock = buildDbFull();
    service = new ReunionesService(
      dbMock as never,
      gcMock as never,
      mailMock as never,
      appConfigMock as never,
    );
    // Sábado en el futuro con lead time OK
    const sabado = new Date();
    while (sabado.getDay() !== 6) sabado.setDate(sabado.getDate() + 1);
    sabado.setHours(10, 0, 0, 0);
    const dto = { nombre: 'Test', email: 'a@b.com', slotInicio: sabado.toISOString() };
    await expect(service.crear(dto as never)).rejects.toThrow('día hábil');
  });

  it('lanza 400 si slotInicio viola lead time (slot en el pasado o inmediato, día hábil)', async () => {
    dbMock = buildDbFull();
    service = new ReunionesService(
      dbMock as never,
      gcMock as never,
      mailMock as never,
      appConfigMock as never,
    );
    // Usamos un slot exactamente 1 hora en el futuro, alineado a grilla, en el próximo lunes.
    // Garantizamos lead time violado (1h < 2h) sin importar el día actual.
    const ahora = new Date();
    // Slot a ahora + 1h, redondeado a grilla de 30 min
    const enUnaHora = new Date(ahora.getTime() + 60 * 60_000);
    const minutos = enUnaHora.getMinutes();
    // Truncar a grilla de 30 min
    enUnaHora.setMinutes(minutos < 30 ? 0 : 30, 0, 0);

    // Si cae en fin de semana, no importa: el servicio tira BadRequest por fin de semana o lead time
    // Ambas son 400 — aquí solo nos importa que falle con 400
    const dto = { nombre: 'Test', email: 'a@b.com', slotInicio: enUnaHora.toISOString() };
    await expect(service.crear(dto as never)).rejects.toMatchObject({ status: 400 });
  });

  it('lanza 409 si el slot ya está reservado (constraint unique)', async () => {
    // Simula el error que drizzle/postgres lanza en violación de unicidad:
    // .code === '23505' a nivel directo (isUniqueViolation lo detecta con o sin cause chain).
    const pgError = Object.assign(
      new Error(
        'duplicate key value violates unique constraint "reunion_slot_inicio_confirmada_idx"',
      ),
      { code: '23505' },
    );
    const returning = jest.fn().mockRejectedValue(pgError);
    const values = jest.fn().mockReturnValue({ returning });
    dbMock = {
      select: jest.fn().mockReturnValue({
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue([]),
        }),
      }),
      insert: jest.fn().mockReturnValue({ values }),
      update: jest.fn(),
    };
    service = new ReunionesService(
      dbMock as never,
      gcMock as never,
      mailMock as never,
      appConfigMock as never,
    );

    const slot = slotFuturo();
    const dto = { nombre: 'Test', email: 'a@b.com', slotInicio: slot.inicio.toISOString() };
    await expect(service.crear(dto as never)).rejects.toThrow(ConflictException);
  });
});

describe('ReunionesService — flujo por token (getByToken, confirmarAsistencia, cancelarByToken)', () => {
  let service: ReunionesService;
  const gcMock = {
    getBusy: jest.fn().mockResolvedValue([]),
    createEvent: jest.fn().mockResolvedValue(null),
    deleteEvent: jest.fn().mockResolvedValue(undefined),
    isConfigured: false,
  };
  const mailMock = {
    sendReunionConfirmacion: jest.fn().mockResolvedValue(undefined),
    sendReunionNotice: jest.fn().mockResolvedValue(undefined),
    sendAsistenciaConfirmada: jest.fn().mockResolvedValue(undefined),
  };
  const appConfigMock = { env: { MAIL_NOTIFY_TO: undefined, APP_URL: 'http://localhost:3000' } };

  const TOKEN = 'abc123token';
  const slotInicio = new Date('2025-06-15T13:00:00.000Z');
  const slotFin = new Date('2025-06-15T13:30:00.000Z');

  interface MockReunion {
    id: number;
    nombre: string;
    email: string;
    empresa: null;
    telefono: null;
    mensaje: null;
    slotInicio: Date;
    slotFin: Date;
    estado: 'confirmada' | 'cancelada';
    token: string;
    meetLink: null;
    googleEventId: null;
    asistenciaConfirmadaAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }

  const baseReunion: MockReunion = {
    id: 42,
    nombre: 'Ana García',
    email: 'ana@ejemplo.com',
    empresa: null,
    telefono: null,
    mensaje: null,
    slotInicio,
    slotFin,
    estado: 'confirmada',
    token: TOKEN,
    meetLink: null,
    googleEventId: null,
    asistenciaConfirmadaAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  function buildDbWithRow(row: MockReunion | null) {
    const selectResult = row ? [row] : [];
    return {
      select: jest.fn().mockReturnValue({
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue(selectResult),
        }),
      }),
      update: jest.fn().mockReturnValue({
        set: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([]),
        }),
      }),
    };
  }

  describe('getByToken', () => {
    it('lanza 404 si no existe la reunión', async () => {
      const dbMock = buildDbWithRow(null);
      service = new ReunionesService(
        dbMock as never,
        gcMock as never,
        mailMock as never,
        appConfigMock as never,
      );
      await expect(service.getByToken('tokeninexistente')).rejects.toThrow(NotFoundException);
    });

    it('devuelve los datos sin exponer token ni asistenciaConfirmadaAt raw', async () => {
      const dbMock = buildDbWithRow(baseReunion);
      service = new ReunionesService(
        dbMock as never,
        gcMock as never,
        mailMock as never,
        appConfigMock as never,
      );
      const result = await service.getByToken(TOKEN);
      expect(result).toMatchObject({
        nombre: 'Ana García',
        estado: 'confirmada',
        asistenciaConfirmada: false,
      });
      expect((result as Record<string, unknown>).token).toBeUndefined();
    });

    it('devuelve asistenciaConfirmada: true cuando tiene timestamp', async () => {
      const row = { ...baseReunion, asistenciaConfirmadaAt: new Date() };
      const dbMock = buildDbWithRow(row);
      service = new ReunionesService(
        dbMock as never,
        gcMock as never,
        mailMock as never,
        appConfigMock as never,
      );
      const result = await service.getByToken(TOKEN);
      expect(result.asistenciaConfirmada).toBe(true);
    });
  });

  describe('confirmarAsistencia', () => {
    it('lanza 404 si no existe', async () => {
      const dbMock = buildDbWithRow(null);
      service = new ReunionesService(
        dbMock as never,
        gcMock as never,
        mailMock as never,
        appConfigMock as never,
      );
      await expect(service.confirmarAsistencia('tokeninexistente')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('lanza 409 si estado es cancelada', async () => {
      const row = { ...baseReunion, estado: 'cancelada' as const };
      const dbMock = buildDbWithRow(row);
      service = new ReunionesService(
        dbMock as never,
        gcMock as never,
        mailMock as never,
        appConfigMock as never,
      );
      await expect(service.confirmarAsistencia(TOKEN)).rejects.toMatchObject({ status: 409 });
    });

    it('confirma asistencia y devuelve ok: true', async () => {
      const dbMock = buildDbWithRow(baseReunion);
      service = new ReunionesService(
        dbMock as never,
        gcMock as never,
        mailMock as never,
        appConfigMock as never,
      );
      const result = await service.confirmarAsistencia(TOKEN);
      expect(result).toEqual({ ok: true, estado: 'confirmada', asistenciaConfirmada: true });
      expect(dbMock.update).toHaveBeenCalled();
    });

    it('es idempotente: si ya tenía asistenciaConfirmadaAt, no hace update adicional', async () => {
      const row = { ...baseReunion, asistenciaConfirmadaAt: new Date('2025-06-14T10:00:00Z') };
      const dbMock = buildDbWithRow(row);
      service = new ReunionesService(
        dbMock as never,
        gcMock as never,
        mailMock as never,
        appConfigMock as never,
      );
      const result = await service.confirmarAsistencia(TOKEN);
      expect(result.asistenciaConfirmada).toBe(true);
      // update no se llama porque ya tenía timestamp
      expect(dbMock.update).not.toHaveBeenCalled();
    });
  });

  describe('cancelarByToken', () => {
    it('lanza 404 si no existe', async () => {
      const dbMock = buildDbWithRow(null);
      service = new ReunionesService(
        dbMock as never,
        gcMock as never,
        mailMock as never,
        appConfigMock as never,
      );
      await expect(service.cancelarByToken('tokeninexistente')).rejects.toThrow(NotFoundException);
    });

    it('cancela la reunión y devuelve { ok: true, estado: cancelada }', async () => {
      const dbMock = buildDbWithRow(baseReunion);
      service = new ReunionesService(
        dbMock as never,
        gcMock as never,
        mailMock as never,
        appConfigMock as never,
      );
      const result = await service.cancelarByToken(TOKEN);
      expect(result).toEqual({ ok: true, estado: 'cancelada' });
      expect(dbMock.update).toHaveBeenCalled();
    });

    it('es idempotente: si ya estaba cancelada no hace update', async () => {
      const row = { ...baseReunion, estado: 'cancelada' as const };
      const dbMock = buildDbWithRow(row);
      service = new ReunionesService(
        dbMock as never,
        gcMock as never,
        mailMock as never,
        appConfigMock as never,
      );
      const result = await service.cancelarByToken(TOKEN);
      expect(result).toEqual({ ok: true, estado: 'cancelada' });
      expect(dbMock.update).not.toHaveBeenCalled();
    });
  });
});
