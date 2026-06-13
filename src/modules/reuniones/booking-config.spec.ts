import '../../tz'; // anclar TZ a AR antes de cualquier parseo de fechas

import {
  DIAS_HABILES,
  DURACION_MIN,
  HORA_FIN,
  HORA_INICIO,
  generarSlotsDelDia,
} from './booking-config';

/** Convierte una Date a "HH:MM" en TZ local (AR). */
function toHHMM(d: Date): string {
  const h = d.getHours().toString().padStart(2, '0');
  const m = d.getMinutes().toString().padStart(2, '0');
  return `${h}:${m}`;
}

describe('generarSlotsDelDia', () => {
  it('devuelve vacío para un sábado', () => {
    // 2025-01-04 es sábado
    expect(generarSlotsDelDia('2025-01-04')).toHaveLength(0);
  });

  it('devuelve vacío para un domingo', () => {
    // 2025-01-05 es domingo
    expect(generarSlotsDelDia('2025-01-05')).toHaveLength(0);
  });

  it('devuelve la cantidad correcta de slots para un lunes', () => {
    // 2025-01-06 es lunes
    // 10:00–18:00 con slots de 30 min → (18-10)*60/30 = 16 slots
    const slots = generarSlotsDelDia('2025-01-06');
    const [hInicio, mInicio] = HORA_INICIO.split(':').map(Number);
    const [hFin, mFin] = HORA_FIN.split(':').map(Number);
    const totalMin = (hFin ?? 0) * 60 + (mFin ?? 0) - ((hInicio ?? 0) * 60 + (mInicio ?? 0));
    const expected = totalMin / DURACION_MIN;
    expect(slots).toHaveLength(expected);
  });

  it('el primer slot empieza a las HORA_INICIO', () => {
    const slots = generarSlotsDelDia('2025-01-06');
    expect(slots.length).toBeGreaterThan(0);
    expect(toHHMM(slots[0]!.inicio)).toBe(HORA_INICIO);
  });

  it('el último slot termina en o antes de HORA_FIN', () => {
    const slots = generarSlotsDelDia('2025-01-06');
    expect(slots.length).toBeGreaterThan(0);
    const lastFin = slots[slots.length - 1]!.fin;
    expect(toHHMM(lastFin)).toBe(HORA_FIN);
  });

  it('cada slot dura exactamente DURACION_MIN minutos', () => {
    const slots = generarSlotsDelDia('2025-01-06');
    for (const slot of slots) {
      expect(slot.fin.getTime() - slot.inicio.getTime()).toBe(DURACION_MIN * 60 * 1000);
    }
  });

  it('cubre todos los días hábiles (lun-vie) para una semana dada', () => {
    // Semana del 06 al 12 de enero de 2025
    const dias = ['2025-01-06', '2025-01-07', '2025-01-08', '2025-01-09', '2025-01-10'];
    for (const d of dias) {
      const slots = generarSlotsDelDia(d);
      expect(slots.length).toBeGreaterThan(0);
    }
  });

  it('los días hábiles esperados son lunes a viernes', () => {
    expect(DIAS_HABILES.has(0)).toBe(false); // domingo
    expect(DIAS_HABILES.has(1)).toBe(true); // lunes
    expect(DIAS_HABILES.has(5)).toBe(true); // viernes
    expect(DIAS_HABILES.has(6)).toBe(false); // sábado
  });

  it('devuelve vacío para fecha inválida', () => {
    expect(generarSlotsDelDia('not-a-date')).toHaveLength(0);
  });
});
