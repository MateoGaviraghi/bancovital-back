/**
 * Detecta una violación de unicidad de Postgres (SQLSTATE 23505).
 *
 * drizzle-orm envuelve el error original en `Error: Failed query: ...` y deja
 * el error de postgres (que lleva `.code`) en `.cause`, por lo que un chequeo
 * de `.code` a nivel superior NO lo encuentra. Esta función camina la cadena
 * de `cause` para detectarlo de forma confiable, esté envuelto o no.
 */
export function isUniqueViolation(err: unknown): boolean {
  let current: unknown = err;
  for (let depth = 0; depth < 6 && current != null; depth++) {
    if ((current as { code?: unknown }).code === '23505') return true;
    current = (current as { cause?: unknown }).cause;
  }
  return false;
}
