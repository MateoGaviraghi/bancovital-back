import { ForbiddenException } from '@nestjs/common';

export type UserRole = 'admin' | 'recepcion' | 'bioquimico' | 'super';

export const USER_ROLES: readonly UserRole[] = ['admin', 'recepcion', 'bioquimico', 'super'] as const;

export interface Session {
  userId: string;
  email: string;
  role: UserRole;
  /** null solo para role='super' (cross-tenant, no pertenece a un lab específico) */
  labId: number | null;
}

/** Extrae el labId de la sesión o lanza 403 si es superusuario (que no tiene lab propio). */
export function requireLabId(session: Session): number {
  if (session.labId === null) {
    throw new ForbiddenException('Los superusuarios no pueden operar sobre recursos de un laboratorio específico');
  }
  return session.labId;
}
