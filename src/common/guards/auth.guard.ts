import { JWT_VERIFIER } from '@/auth/auth.module';
import type { Session } from '@/auth/session';
import { TenantService } from '@/auth/tenant.service';
import type { JwtVerifier, PartialSession } from '@/auth/verify';
import { IS_PUBLIC_KEY } from '@/common/decorators/public.decorator';
import { type CanActivate, type ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(JWT_VERIFIER) private readonly verifier: JwtVerifier,
    private readonly tenantService: TenantService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest<{
      headers: Record<string, string | string[] | undefined>;
      session?: Session;
    }>();

    const authHeader = readAuthHeader(req.headers);
    const partial: PartialSession = await this.verifier.verifyAuthHeader(authHeader);

    // Tenant REAL resuelto desde la DB (fuente de verdad del rol).
    const tenant = await this.tenantService.resolve(partial.userId);

    // Impersonation: SOLO se honra para un super VERIFICADO en DB.
    // La barrera de seguridad es `tenant.role === 'super'`: el header
    // x-impersonate-lab se ignora por completo para cualquier otro rol.
    // Para un super, entrar a un lab es DE-escalar (queda acotado a ese lab
    // como admin), no escalar; no agrega superficie más allá de su cuenta.
    if (tenant.role === 'super') {
      const impersonatedLabId = parsePositiveInt(readHeader(req.headers, 'x-impersonate-lab'));
      if (impersonatedLabId !== null) {
        req.session = {
          userId: partial.userId,
          email: partial.email,
          role: 'admin',
          labId: impersonatedLabId,
          impersonating: true,
          realUserId: partial.userId,
          realRole: 'super',
        };
        return true;
      }
    }

    req.session = {
      userId: partial.userId,
      email: partial.email,
      labId: tenant.labId,
      role: tenant.role,
    };
    return true;
  }
}

function readHeader(
  headers: Record<string, string | string[] | undefined>,
  name: string,
): string | undefined {
  const raw = headers[name] ?? headers[name.toLowerCase()];
  if (!raw) return undefined;
  return Array.isArray(raw) ? raw[0] : raw;
}

/** Devuelve el entero positivo o null si el valor no parsea limpiamente. */
function parsePositiveInt(value: string | undefined): number | null {
  if (value === undefined) return null;
  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const n = Number.parseInt(trimmed, 10);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function readAuthHeader(
  headers: Record<string, string | string[] | undefined>,
): string | undefined {
  const raw = headers.authorization ?? headers.Authorization;
  if (!raw) return undefined;
  return Array.isArray(raw) ? raw[0] : raw;
}
