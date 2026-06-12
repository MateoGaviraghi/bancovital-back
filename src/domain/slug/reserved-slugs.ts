/**
 * Slugs de laboratorio que están reservados por el sistema y no pueden ser usados por ningún tenant.
 * Actualizar aquí si se agregan nuevas rutas de sistema.
 */
export const RESERVED_SLUGS = [
  'super',
  'login',
  'auth',
  'api',
  'contratar',
  'r',
  'admin',
  'configuracion',
  'public',
] as const;

/** Regex de slug válido: solo lowercase, números y guiones; no puede empezar ni terminar con guion. */
export const SLUG_REGEX = /^[a-z0-9](?:[a-z0-9-]{1,61}[a-z0-9])?$/;
