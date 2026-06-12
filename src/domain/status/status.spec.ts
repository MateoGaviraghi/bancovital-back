import { type OrderStatus, canTransition, isTerminal, nextStatuses } from './status';

describe('canTransition (matriz completa)', () => {
  const ALL: OrderStatus[] = [
    'borrador',
    'confirmada',
    'en_proceso',
    'resultados_cargados',
    'emitida',
    'entregada',
    'anulada',
  ];

  const VALID: Array<[OrderStatus, OrderStatus]> = [
    ['borrador', 'confirmada'],
    ['borrador', 'anulada'],
    ['confirmada', 'en_proceso'],
    ['confirmada', 'anulada'],
    ['en_proceso', 'resultados_cargados'],
    ['en_proceso', 'anulada'],
    ['resultados_cargados', 'emitida'],
    ['resultados_cargados', 'anulada'],
    ['emitida', 'entregada'],
    ['emitida', 'anulada'],
  ];

  it.each(VALID)('permite %s -> %s', (from, to) => {
    expect(canTransition(from, to)).toBe(true);
  });

  it('rechaza saltos de etapa', () => {
    expect(canTransition('borrador', 'emitida')).toBe(false);
    expect(canTransition('borrador', 'en_proceso')).toBe(false);
    expect(canTransition('confirmada', 'emitida')).toBe(false);
    expect(canTransition('confirmada', 'resultados_cargados')).toBe(false);
  });

  it('rechaza retrocesos', () => {
    expect(canTransition('en_proceso', 'borrador')).toBe(false);
    expect(canTransition('emitida', 'resultados_cargados')).toBe(false);
    expect(canTransition('entregada', 'emitida')).toBe(false);
  });

  it('entregada y anulada son terminales (no permiten salir)', () => {
    for (const to of ALL) {
      expect(canTransition('entregada', to)).toBe(false);
      expect(canTransition('anulada', to)).toBe(false);
    }
  });

  it('rechaza self-loops salvo que esten explicitamente permitidos (no lo estan)', () => {
    for (const s of ALL) {
      expect(canTransition(s, s)).toBe(false);
    }
  });
});

describe('nextStatuses', () => {
  it('devuelve la lista exacta de proximos estados', () => {
    expect(nextStatuses('borrador')).toEqual(['confirmada', 'anulada']);
    expect(nextStatuses('confirmada')).toEqual(['en_proceso', 'anulada']);
    expect(nextStatuses('en_proceso')).toEqual(['resultados_cargados', 'anulada']);
    expect(nextStatuses('resultados_cargados')).toEqual(['emitida', 'anulada']);
    expect(nextStatuses('emitida')).toEqual(['entregada', 'anulada']);
    expect(nextStatuses('entregada')).toEqual([]);
    expect(nextStatuses('anulada')).toEqual([]);
  });
});

describe('isTerminal', () => {
  it('identifica entregada y anulada como terminales', () => {
    expect(isTerminal('entregada')).toBe(true);
    expect(isTerminal('anulada')).toBe(true);
  });

  it('todos los demas no son terminales', () => {
    expect(isTerminal('borrador')).toBe(false);
    expect(isTerminal('confirmada')).toBe(false);
    expect(isTerminal('en_proceso')).toBe(false);
    expect(isTerminal('resultados_cargados')).toBe(false);
    expect(isTerminal('emitida')).toBe(false);
  });
});
