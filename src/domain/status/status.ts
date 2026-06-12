export type OrderStatus =
  | 'borrador'
  | 'confirmada'
  | 'en_proceso'
  | 'resultados_cargados'
  | 'emitida'
  | 'entregada'
  | 'anulada';

const TRANSITIONS: Readonly<Record<OrderStatus, readonly OrderStatus[]>> = {
  borrador: ['confirmada', 'anulada'],
  confirmada: ['en_proceso', 'anulada'],
  en_proceso: ['resultados_cargados', 'anulada'],
  resultados_cargados: ['emitida', 'anulada'],
  emitida: ['entregada', 'anulada'],
  entregada: [],
  anulada: [],
};

const TERMINAL: ReadonlySet<OrderStatus> = new Set(['entregada', 'anulada']);

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export function nextStatuses(from: OrderStatus): readonly OrderStatus[] {
  return TRANSITIONS[from];
}

export function isTerminal(status: OrderStatus): boolean {
  return TERMINAL.has(status);
}
