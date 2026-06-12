import { type CanActivate, type ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JWT_VERIFIER } from '@/auth/auth.module';
import type { Session } from '@/auth/session';
import { TenantService } from '@/auth/tenant.service';
import type { JwtVerifier, PartialSession } from '@/auth/verify';
import { IS_PUBLIC_KEY } from '@/common/decorators/public.decorator';

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

    const tenant = await this.tenantService.resolve(partial.userId);

    req.session = {
      userId: partial.userId,
      email: partial.email,
      labId: tenant.labId,
      role: tenant.role,
    };
    return true;
  }
}

function readAuthHeader(
  headers: Record<string, string | string[] | undefined>,
): string | undefined {
  const raw = headers.authorization ?? headers.Authorization;
  if (!raw) return undefined;
  return Array.isArray(raw) ? raw[0] : raw;
}
