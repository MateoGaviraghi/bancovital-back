import type { Db } from '@/db/client';
import { Logger } from '@nestjs/common';
import { AuditService } from './audit.service';

function makeDb(insertImpl: () => Promise<unknown>) {
  const values = jest.fn().mockImplementation(insertImpl);
  const insert = jest.fn().mockReturnValue({ values });
  return { db: { insert } as unknown as Db, insert, values };
}

describe('AuditService', () => {
  it('inserta una fila en audit_log con los campos mapeados', async () => {
    const { db, insert, values } = makeDb(() => Promise.resolve(undefined));
    const service = new AuditService(db);

    await service.log({
      labId: 5,
      actorId: 'super-1',
      action: 'impersonate_enter',
      entity: 'laboratorio',
      entityId: 5,
      ip: '1.2.3.4',
      userAgent: 'jest',
    });

    expect(insert).toHaveBeenCalledTimes(1);
    expect(values).toHaveBeenCalledTimes(1);
    expect(values).toHaveBeenCalledWith({
      labId: 5,
      actorId: 'super-1',
      action: 'impersonate_enter',
      entity: 'laboratorio',
      entityId: '5', // coerced to string
      before: null,
      after: null,
      ip: '1.2.3.4',
      userAgent: 'jest',
    });
  });

  it('normaliza campos opcionales ausentes a null', async () => {
    const { db, values } = makeDb(() => Promise.resolve(undefined));
    const service = new AuditService(db);

    await service.log({ labId: 1, action: 'lab_export', entity: 'laboratorio', entityId: 1 });

    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: null,
        before: null,
        after: null,
        ip: null,
        userAgent: null,
      }),
    );
  });

  it('es best-effort: si el insert falla, NO propaga el error', async () => {
    const { db, insert } = makeDb(() => Promise.reject(new Error('db down')));
    const service = new AuditService(db);
    // Silenciamos el logger interno (warn) para no ensuciar la salida del test.
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);

    await expect(
      service.log({ labId: 1, action: 'lab_purge', entity: 'laboratorio', entityId: 1 }),
    ).resolves.toBeUndefined();

    expect(insert).toHaveBeenCalledTimes(1);
  });
});
