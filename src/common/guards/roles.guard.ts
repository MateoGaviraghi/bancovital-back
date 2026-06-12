import type { Session, UserRole } from '@/auth/session';
import { ROLES_KEY } from '@/common/decorators/roles.decorator';
import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<UserRole[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const req = context.switchToHttp().getRequest<{ session?: Session }>();
    const role = req.session?.role;

    if (!role) {
      throw new ForbiddenException('No autenticado');
    }
    if (!required.includes(role)) {
      throw new ForbiddenException(`Rol ${role} no autorizado para esta accion`);
    }
    return true;
  }
}
