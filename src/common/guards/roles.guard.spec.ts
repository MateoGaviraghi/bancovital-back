import { type ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Session, UserRole } from '@/auth/session';
import { ROLES_KEY } from '@/common/decorators/roles.decorator';
import { RolesGuard } from './roles.guard';

function ctxWithSession(session: Session | undefined): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ session }) }),
    getHandler: () => () => undefined,
    getClass: () => class {},
  } as unknown as ExecutionContext;
}

describe('RolesGuard', () => {
  let reflector: Reflector;
  let guard: RolesGuard;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new RolesGuard(reflector);
  });

  it('permite paso si el handler no tiene @Roles()', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    expect(guard.canActivate(ctxWithSession({ userId: 'u', email: '', role: 'admin', labId: 1 }))).toBe(true);
  });

  it('permite paso si @Roles() esta vacio', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([] as UserRole[]);
    expect(guard.canActivate(ctxWithSession({ userId: 'u', email: '', role: 'recepcion', labId: 1 }))).toBe(
      true,
    );
  });

  it('permite paso si el rol del usuario esta en la lista', () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockImplementation((key) => (key === ROLES_KEY ? ['admin', 'recepcion'] : undefined));
    expect(guard.canActivate(ctxWithSession({ userId: 'u', email: '', role: 'recepcion', labId: 1 }))).toBe(
      true,
    );
  });

  it('lanza 403 si el rol no esta autorizado', () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockImplementation((key) => (key === ROLES_KEY ? ['admin'] : undefined));
    expect(() =>
      guard.canActivate(ctxWithSession({ userId: 'u', email: '', role: 'bioquimico', labId: 1 })),
    ).toThrow(ForbiddenException);
  });

  it('lanza 403 si no hay session en el request', () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockImplementation((key) => (key === ROLES_KEY ? ['admin'] : undefined));
    expect(() => guard.canActivate(ctxWithSession(undefined))).toThrow(ForbiddenException);
  });
});
