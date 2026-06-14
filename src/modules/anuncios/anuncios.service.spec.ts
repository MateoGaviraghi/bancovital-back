import { anuncio } from '@/db/schema';
import { AnunciosService } from './anuncios.service';

/**
 * Serializa un SQL de drizzle a un string inspeccionable, recolectando:
 * - nombres de columna referenciados
 * - valores de parámetros (params)
 * Recorre recursivamente queryChunks.
 */
function inspectSql(node: unknown): { columns: string[]; params: unknown[] } {
  const columns: string[] = [];
  const params: unknown[] = [];

  const walk = (n: unknown): void => {
    if (n == null) return;
    if (Array.isArray(n)) {
      for (const c of n) walk(c);
      return;
    }
    const obj = n as Record<string, unknown>;
    // Param (drizzle Param tiene .value)
    if ('value' in obj && !('queryChunks' in obj) && typeof obj.value !== 'object') {
      params.push(obj.value);
    }
    // Column (tiene .name y .table)
    if (typeof obj.name === 'string' && 'table' in obj) {
      columns.push(obj.name);
    }
    if (Array.isArray(obj.queryChunks)) walk(obj.queryChunks);
  };

  walk(node);
  return { columns, params };
}

describe('AnunciosService.scopeWhere — scope de seguridad (lab vs global)', () => {
  const now = new Date('2026-06-15T12:00:00.000Z');

  it('super (labId null) → solo globales: filtra por lab_id IS NULL, sin valor de lab', () => {
    const where = AnunciosService.scopeWhere(null, now);
    const { columns, params } = inspectSql(where);

    // Referencia la columna lab_id (para el IS NULL global)
    expect(columns).toContain('lab_id');
    // Filtra por activo y deleted_at
    expect(columns).toContain('activo');
    expect(columns).toContain('deleted_at');
    // NUNCA debe haber un id de lab como parámetro (no se filtra por lab ajeno)
    const numericParams = params.filter((p) => typeof p === 'number');
    expect(numericParams).toHaveLength(0);
  });

  it('lab (labId 7) → globales OR propios: incluye el labId 7 como parámetro', () => {
    const where = AnunciosService.scopeWhere(7, now);
    const { params } = inspectSql(where);

    // El labId del caller aparece como parámetro (eq(anuncio.labId, 7))
    expect(params).toContain(7);
  });

  it('lab (labId 7) NUNCA filtra por el id de otro lab', () => {
    const where = AnunciosService.scopeWhere(7, now);
    const { params } = inspectSql(where);
    const otherLabIds = params.filter((p) => typeof p === 'number' && p !== 7);
    expect(otherLabIds).toHaveLength(0);
  });
});

describe('AnunciosService.forCaller — delega el scope con el labId correcto', () => {
  function makeDb(capture: (where: unknown) => void) {
    return {
      select: () => ({
        from: () => ({
          where: (w: unknown) => {
            capture(w);
            return { orderBy: () => Promise.resolve([]) };
          },
        }),
      }),
    } as never;
  }

  const auditStub = { log: jest.fn() } as never;

  it('un usuario de lab pasa su propio labId al scope', async () => {
    const spy = jest.spyOn(AnunciosService, 'scopeWhere');
    const svc = new AnunciosService(
      makeDb(() => {}),
      auditStub,
    );
    await svc.forCaller(7);
    expect(spy).toHaveBeenCalledWith(7, expect.any(Date));
    spy.mockRestore();
  });

  it('un super (labId null) pasa null al scope (solo globales)', async () => {
    const spy = jest.spyOn(AnunciosService, 'scopeWhere');
    const svc = new AnunciosService(
      makeDb(() => {}),
      auditStub,
    );
    await svc.forCaller(null);
    expect(spy).toHaveBeenCalledWith(null, expect.any(Date));
    spy.mockRestore();
  });

  // Sanity: el schema tiene la columna lab_id nullable (global = null)
  it('el schema anuncio tiene columna lab_id', () => {
    expect(anuncio.labId).toBeDefined();
  });
});
