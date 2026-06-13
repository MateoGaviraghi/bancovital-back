import { isUniqueViolation } from './db-errors';

describe('isUniqueViolation', () => {
  it('devuelve true si el error tiene .code === "23505" directo', () => {
    const err = Object.assign(new Error('unique violation'), { code: '23505' });
    expect(isUniqueViolation(err)).toBe(true);
  });

  it('devuelve true si el error está envuelto en cause', () => {
    const pgErr = Object.assign(new Error('duplicate key'), { code: '23505' });
    const wrapper = new Error('Failed query');
    (wrapper as unknown as { cause: unknown }).cause = pgErr;
    expect(isUniqueViolation(wrapper)).toBe(true);
  });

  it('devuelve true si el error está anidado a mayor profundidad en cause', () => {
    const pgErr = Object.assign(new Error('duplicate key'), { code: '23505' });
    const mid = new Error('middle');
    (mid as unknown as { cause: unknown }).cause = pgErr;
    const outer = new Error('outer');
    (outer as unknown as { cause: unknown }).cause = mid;
    expect(isUniqueViolation(outer)).toBe(true);
  });

  it('devuelve false para un error sin relación', () => {
    const err = new Error('something else');
    expect(isUniqueViolation(err)).toBe(false);
  });

  it('devuelve false para código de error diferente', () => {
    const err = Object.assign(new Error('foreign key'), { code: '23503' });
    expect(isUniqueViolation(err)).toBe(false);
  });

  it('devuelve false para null', () => {
    expect(isUniqueViolation(null)).toBe(false);
  });

  it('devuelve false para undefined', () => {
    expect(isUniqueViolation(undefined)).toBe(false);
  });
});
