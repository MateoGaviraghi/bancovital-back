import type { Session } from '@/auth/session';
import type { TenantService } from '@/auth/tenant.service';
import type { JwtVerifier } from '@/auth/verify';
import { IS_PUBLIC_KEY } from '@/common/decorators/public.decorator';
import { type ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from './auth.guard';

function makeCtx(headers: Record<string, string | undefined>): {
  ctx: ExecutionContext;
  req: { headers: Record<string, string | undefined>; session?: Session };
  handler: () => void;
  classRef: new () => unknown;
} {
  const req: { headers: Record<string, string | undefined>; session?: Session } = { headers };
  const handler = () => undefined;
  class C {}
  const ctx = {
    switchToHttp: () => ({ getRequest: () => req }),
    getHandler: () => handler,
    getClass: () => C,
  } as unknown as ExecutionContext;
  return { ctx, req, handler, classRef: C };
}

describe('AuthGuard', () => {
  let reflector: Reflector;
  let verifier: jest.Mocked<JwtVerifier>;
  let tenantService: jest.Mocked<TenantService>;
  let guard: AuthGuard;

  beforeEach(() => {
    reflector = new Reflector();
    verifier = {
      verifyAuthHeader: jest.fn(),
      verifyToken: jest.fn(),
      clearCache: jest.fn(),
    } as unknown as jest.Mocked<JwtVerifier>;
    tenantService = {
      resolve: jest.fn().mockResolvedValue({ labId: 1, role: 'admin' }),
      invalidate: jest.fn(),
    } as unknown as jest.Mocked<TenantService>;
    guard = new AuthGuard(reflector, verifier, tenantService);
  });

  it('permite paso sin auth para endpoints con @Public()', async () => {
    const { ctx } = makeCtx({});
    jest.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) => {
      return key === IS_PUBLIC_KEY ? true : undefined;
    });

    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(verifier.verifyAuthHeader).not.toHaveBeenCalled();
  });

  it('verifica el header e inyecta session en el request', async () => {
    const { ctx, req } = makeCtx({ authorization: 'Bearer xyz' });
    const session: Session = { userId: 'u1', email: 'a@b.com', role: 'admin', labId: 1 };
    verifier.verifyAuthHeader.mockResolvedValue(session);
    tenantService.resolve.mockResolvedValue({ labId: 1, role: 'admin' });

    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(verifier.verifyAuthHeader).toHaveBeenCalledWith('Bearer xyz');
    expect(req.session).toEqual(session);
  });

  it('propaga UnauthorizedException cuando el verifier la lanza', async () => {
    const { ctx } = makeCtx({});
    verifier.verifyAuthHeader.mockRejectedValue(new UnauthorizedException('nope'));

    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });

  it('lee el header en lowercase o capitalized', async () => {
    const { ctx, req } = makeCtx({ Authorization: 'Bearer cap' });
    verifier.verifyAuthHeader.mockResolvedValue({ userId: 'u', email: '', role: 'recepcion' });
    tenantService.resolve.mockResolvedValue({ labId: 1, role: 'recepcion' });

    await guard.canActivate(ctx);
    expect(verifier.verifyAuthHeader).toHaveBeenCalledWith('Bearer cap');
    expect(req.session?.role).toBe('recepcion');
  });

  // ── Impersonation ──────────────────────────────────────────────
  describe('impersonation (x-impersonate-lab)', () => {
    it('super con header válido → sesión EFECTIVA admin + labId + impersonating', async () => {
      const { ctx, req } = makeCtx({
        authorization: 'Bearer s',
        'x-impersonate-lab': '42',
      });
      verifier.verifyAuthHeader.mockResolvedValue({
        userId: 'super-1',
        email: 's@nodo.com',
        role: 'super',
      });
      tenantService.resolve.mockResolvedValue({ labId: null, role: 'super' });

      await guard.canActivate(ctx);

      expect(req.session).toEqual({
        userId: 'super-1',
        email: 's@nodo.com',
        role: 'admin',
        labId: 42,
        impersonating: true,
        realUserId: 'super-1',
        realRole: 'super',
      });
    });

    it('NO-super con header → se IGNORA por completo (sesión normal)', async () => {
      const { ctx, req } = makeCtx({
        authorization: 'Bearer a',
        'x-impersonate-lab': '42',
      });
      verifier.verifyAuthHeader.mockResolvedValue({
        userId: 'admin-1',
        email: 'a@lab.com',
        role: 'admin',
      });
      tenantService.resolve.mockResolvedValue({ labId: 7, role: 'admin' });

      await guard.canActivate(ctx);

      expect(req.session).toEqual({
        userId: 'admin-1',
        email: 'a@lab.com',
        role: 'admin',
        labId: 7,
      });
      expect(req.session?.impersonating).toBeUndefined();
    });

    it('super SIN header → opera como super (labId null), sin impersonation', async () => {
      const { ctx, req } = makeCtx({ authorization: 'Bearer s' });
      verifier.verifyAuthHeader.mockResolvedValue({
        userId: 'super-1',
        email: 's@nodo.com',
        role: 'super',
      });
      tenantService.resolve.mockResolvedValue({ labId: null, role: 'super' });

      await guard.canActivate(ctx);

      expect(req.session).toEqual({
        userId: 'super-1',
        email: 's@nodo.com',
        role: 'super',
        labId: null,
      });
    });

    it('super con header no-entero o no-positivo → se ignora', async () => {
      for (const bad of ['abc', '0', '-3', '1.5', '']) {
        const { ctx, req } = makeCtx({
          authorization: 'Bearer s',
          'x-impersonate-lab': bad,
        });
        verifier.verifyAuthHeader.mockResolvedValue({
          userId: 'super-1',
          email: 's@nodo.com',
          role: 'super',
        });
        tenantService.resolve.mockResolvedValue({ labId: null, role: 'super' });

        await guard.canActivate(ctx);

        expect(req.session?.impersonating).toBeUndefined();
        expect(req.session?.role).toBe('super');
        expect(req.session?.labId).toBeNull();
      }
    });
  });
});
