# 07 — Autenticación + autorización

Auth: Supabase emite JWT. El back valida el token y extrae rol del `app_metadata.role`.

## Tipo Session

`src/auth/session.ts`:

```typescript
export type UserRole = 'admin' | 'recepcion' | 'bioquimico';

export interface Session {
  userId: string;
  email: string;
  role: UserRole;
}
```

## Verify del JWT

`src/auth/verify.ts`:

```typescript
import { createClient } from '@supabase/supabase-js';
import { UnauthorizedException } from '@nestjs/common';
import type { Session, UserRole } from './session';

export async function verifyAuthHeader(authHeader?: string): Promise<Session> {
  if (!authHeader) throw new UnauthorizedException('Missing Authorization header');
  const match = /^Bearer\s+(.+)$/i.exec(authHeader);
  if (!match?.[1]) throw new UnauthorizedException('Malformed Authorization header');
  const token = match[1];

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!,
    {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    },
  );

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) throw new UnauthorizedException('Invalid token');

  const role = (data.user.app_metadata?.role as UserRole | undefined) ?? undefined;
  if (!role) throw new UnauthorizedException('User has no role assigned');

  return {
    userId: data.user.id,
    email: data.user.email ?? '',
    role,
  };
}
```

## AuthGuard

`src/common/guards/auth.guard.ts`:

```typescript
import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { verifyAuthHeader } from '@/auth/verify';

@Injectable()
export class AuthGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const session = await verifyAuthHeader(req.headers.authorization);
    req.session = session;  // attach for @CurrentUser()
    return true;
  }
}
```

## RolesGuard

`src/common/guards/roles.guard.ts`:

```typescript
import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '@/common/decorators/roles.decorator';
import type { UserRole } from '@/auth/session';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const req = context.switchToHttp().getRequest();
    const role = req.session?.role;
    if (!role || !required.includes(role)) {
      throw new ForbiddenException(`Rol ${role ?? 'desconocido'} no autorizado para esta acción`);
    }
    return true;
  }
}
```

## Decorator @Roles()

`src/common/decorators/roles.decorator.ts`:

```typescript
import { SetMetadata } from '@nestjs/common';
import type { UserRole } from '@/auth/session';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
```

## Decorator @CurrentUser()

`src/common/decorators/current-user.decorator.ts`:

```typescript
import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Session } from '@/auth/session';

export const CurrentUser = createParamDecorator(
  (data: keyof Session | undefined, ctx: ExecutionContext): Session | string => {
    const req = ctx.switchToHttp().getRequest();
    const session: Session = req.session;
    return data ? session?.[data] : session;
  },
);
```

## Matrix de permisos

| Action | Roles |
|---|---|
| Buscar/listar todo | admin, recepcion, bioquimico |
| Crear/editar paciente | admin, recepcion |
| Crear/editar médico | admin, recepcion |
| Crear orden | admin, recepcion |
| Confirmar orden | admin, recepcion |
| Cancelar orden | admin |
| Soft-delete médico | admin |
| Cargar resultados | admin, bioquimico |
| Finalizar resultados | admin, bioquimico |
| Emitir informe | admin, bioquimico |
| Editar lab_config | admin |
| Regenerar todos los informes | admin |
| Gestionar usuarios | admin |
| Gestionar obras sociales | admin |
| Setear valor UB | admin |

## Uso en un controller

```typescript
@Controller('orders')
@UseGuards(AuthGuard)
export class OrdersController {
  @Post(':id/cancel')
  @UseGuards(RolesGuard)
  @Roles('admin')
  cancel(@Param('id', ParseIntPipe) id: number, @Body() dto: CancelOrderDto, @CurrentUser() user: Session) {
    return this.service.cancel(id, dto.reason, user.userId);
  }
}
```

## Bloqueo de self-actions (UsersService)

Para evitar que un admin se deshabilite a sí mismo o cambie su propio rol:

```typescript
setRole(targetUserId: string, newRole: UserRole, currentUser: Session) {
  if (targetUserId === currentUser.userId && newRole !== 'admin') {
    throw new ConflictException('No podés cambiar tu propio rol a uno no-admin');
  }
  // ...
}
```

## Notas de seguridad

1. **Nunca commitear `SUPABASE_SERVICE_ROLE_KEY`**. Da acceso total a la DB. Va solo en env vars del servicio.
2. **Logs sin PHI/PII**. No loggear DNI, nombre, email, diagnóstico, resultados.
3. **HTTPS only en prod**. Railway lo hace por default.
4. **Helmet** ya está activado en `main.ts`.
5. **CORS estricto**: solo los dominios del front en `CORS_ALLOWED_ORIGINS`.
