import type { UserRole } from '@/auth/session';

/**
 * Matriz de autorizaciones por accion. Es la fuente canonica de "que rol puede
 * hacer que". El decorator @Roles() expone esto a nivel de controller (declarativo),
 * mientras que can() permite checks programaticos dentro de services cuando el
 * permiso depende del contexto (ej: "puede leer SI es admin O dueno del recurso").
 */
export type Action =
  | 'patient.create'
  | 'patient.update'
  | 'doctor.create'
  | 'doctor.update'
  | 'doctor.delete'
  | 'insurer.manage'
  | 'ub.update'
  | 'order.create'
  | 'order.confirm'
  | 'order.cancel'
  | 'order.finalize'
  | 'result.upsert'
  | 'report.emit'
  | 'report.regenerate'
  | 'lab.update'
  | 'user.manage';

const MATRIX: Readonly<Record<Action, ReadonlyArray<UserRole>>> = {
  'patient.create': ['admin', 'recepcion', 'bioquimico'],
  'patient.update': ['admin', 'recepcion', 'bioquimico'],
  'doctor.create': ['admin', 'recepcion', 'bioquimico'],
  'doctor.update': ['admin', 'recepcion', 'bioquimico'],
  'doctor.delete': ['admin'],
  'insurer.manage': ['admin'],
  'ub.update': ['admin'],
  'order.create': ['admin', 'recepcion', 'bioquimico'],
  'order.confirm': ['admin', 'recepcion', 'bioquimico'],
  'order.cancel': ['admin'],
  'order.finalize': ['admin', 'recepcion', 'bioquimico'],
  'result.upsert': ['admin', 'recepcion', 'bioquimico'],
  'report.emit': ['admin', 'recepcion', 'bioquimico'],
  'report.regenerate': ['admin'],
  'lab.update': ['admin'],
  'user.manage': ['admin'],
};

export function can(role: UserRole, action: Action): boolean {
  return MATRIX[action].includes(role);
}

export function rolesFor(action: Action): ReadonlyArray<UserRole> {
  return MATRIX[action];
}
