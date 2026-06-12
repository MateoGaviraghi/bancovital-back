import type { Session } from '@/auth/session';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { UsersService } from './users.service';

/**
 * Tests focalizados en reglas de proteccion: self-demotion y self-deactivation.
 * El flujo completo (list/invite con Supabase admin real) se testea con pnpm smoke.
 */

const LAB_ID = 1;
const SELF: Session = { userId: 'self-uuid', email: 'self@test.com', role: 'admin', labId: LAB_ID };
const OTHER: Session = {
  userId: 'other-uuid',
  email: 'other@test.com',
  role: 'admin',
  labId: LAB_ID,
};

function makeService(opts: {
  updateUserResponse?: { error: { message: string; status?: number } | null };
  publicUserRow?: { id: string; role: string; active: boolean } | null;
}): UsersService {
  const updateUserById = jest.fn().mockResolvedValue(opts.updateUserResponse ?? { error: null });

  const admin = {
    auth: {
      admin: {
        updateUserById,
        listUsers: jest.fn(),
        inviteUserByEmail: jest.fn(),
      },
    },
  };

  const selectResult = opts.publicUserRow ? [{ id: opts.publicUserRow.id }] : [];
  const db = {
    update: jest.fn().mockImplementation(() => ({
      set: () => ({
        where: () => ({
          returning: () => Promise.resolve(opts.publicUserRow ? [opts.publicUserRow] : []),
        }),
      }),
    })),
    select: jest.fn().mockReturnValue({
      from: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue(selectResult),
        }),
      }),
    }),
    insert: jest.fn(),
  };

  const tenantService = { resolve: jest.fn(), invalidate: jest.fn() };
  const appConfig = { env: { APP_URL: 'http://localhost:3000' } };
  return new UsersService(db as never, admin as never, tenantService as never, appConfig as never);
}

describe('UsersService.setRole', () => {
  it('BLOQUEA self-demotion (admin cambia su propio rol a no-admin)', async () => {
    const service = makeService({});
    await expect(service.setRole(LAB_ID, SELF.userId, 'recepcion', SELF)).rejects.toThrow(
      ConflictException,
    );
  });

  it('PERMITE mantener self como admin (no es demotion)', async () => {
    const service = makeService({
      publicUserRow: { id: SELF.userId, role: 'admin', active: true },
    });
    const row = await service.setRole(LAB_ID, SELF.userId, 'admin', SELF);
    expect(row.role).toBe('admin');
  });

  it('PERMITE degradar a OTRO usuario', async () => {
    const service = makeService({
      publicUserRow: { id: OTHER.userId, role: 'recepcion', active: true },
    });
    const row = await service.setRole(LAB_ID, OTHER.userId, 'recepcion', SELF);
    expect(row.role).toBe('recepcion');
  });

  it('propaga 404 si Supabase no encuentra al usuario', async () => {
    const service = makeService({
      updateUserResponse: { error: { message: 'not found', status: 404 } },
    });
    await expect(service.setRole(LAB_ID, OTHER.userId, 'bioquimico', SELF)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('lanza NotFoundException si Supabase OK pero public.user no tiene mirror', async () => {
    const service = makeService({ publicUserRow: null });
    await expect(service.setRole(LAB_ID, OTHER.userId, 'bioquimico', SELF)).rejects.toThrow(
      NotFoundException,
    );
  });
});

describe('UsersService.setActive', () => {
  it('BLOQUEA self-deactivation (admin se desactiva a si mismo)', async () => {
    const service = makeService({});
    await expect(service.setActive(LAB_ID, SELF.userId, false, SELF)).rejects.toThrow(
      ConflictException,
    );
  });

  it('PERMITE re-activar a si mismo (no se autoinhabilita)', async () => {
    const service = makeService({
      publicUserRow: { id: SELF.userId, role: 'admin', active: true },
    });
    const row = await service.setActive(LAB_ID, SELF.userId, true, SELF);
    expect(row.active).toBe(true);
  });

  it('PERMITE desactivar a otro usuario', async () => {
    const service = makeService({
      publicUserRow: { id: OTHER.userId, role: 'recepcion', active: false },
    });
    const row = await service.setActive(LAB_ID, OTHER.userId, false, SELF);
    expect(row.active).toBe(false);
  });

  it('propaga 404 si Supabase no encuentra al usuario', async () => {
    const service = makeService({
      updateUserResponse: { error: { message: 'not found', status: 404 } },
    });
    await expect(service.setActive(LAB_ID, OTHER.userId, true, SELF)).rejects.toThrow(
      NotFoundException,
    );
  });
});
