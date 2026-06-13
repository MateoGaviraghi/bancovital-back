/**
 * Configuración de disponibilidad para reserva de reuniones con Nodo.
 * TZ anclada a America/Argentina/Buenos_Aires en src/tz.ts (UTC-3, sin DST).
 */

/** Días hábiles: 1=Lunes … 5=Viernes (0=Dom, 6=Sáb). */
export const DIAS_HABILES = new Set([1, 2, 3, 4, 5]);

/** Hora de inicio de agenda (inclusive), en hora AR (HH:MM). */
export const HORA_INICIO = '10:00';

/** Hora de fin de agenda (exclusive), en hora AR (HH:MM). */
export const HORA_FIN = '18:00';

/** Duración de cada slot y de la reunión, en minutos. */
export const DURACION_MIN = 30;

/** Lead time mínimo: no se puede reservar con menos de N ms de anticipación. */
export const LEAD_TIME_MS = 2 * 60 * 60 * 1000; // 2 horas

/** Horizonte máximo: no se puede reservar con más de N días de anticipación. */
export const HORIZONTE_DIAS = 21;

/**
 * Genera los slots de disponibilidad bruta para un día dado.
 *
 * @param fecha - Fecha en formato 'YYYY-MM-DD' (se interpreta en TZ local = AR).
 * @returns Array de {inicio, fin} en UTC (Date objects).
 *          Vacío si el día es sábado o domingo.
 */
export function generarSlotsDelDia(fecha: string): { inicio: Date; fin: Date }[] {
  // Parsear la fecha en TZ AR (process.env.TZ ya está anclada a Argentina en tz.ts)
  const [anio, mes, dia] = fecha.split('-').map(Number);
  if (!anio || !mes || !dia) return [];

  // Construir la fecha en hora local (AR)
  const fechaBase = new Date(anio, mes - 1, dia);

  // Día de semana en TZ local (0=Dom, 6=Sáb)
  const diaSemana = fechaBase.getDay();
  if (!DIAS_HABILES.has(diaSemana)) return [];

  const [hInicio, mInicio] = HORA_INICIO.split(':').map(Number);
  const [hFin, mFin] = HORA_FIN.split(':').map(Number);

  const slots: { inicio: Date; fin: Date }[] = [];

  // Inicio del primer slot en minutos desde medianoche AR
  let cursorMin = (hInicio ?? 0) * 60 + (mInicio ?? 0);
  const finMin = (hFin ?? 0) * 60 + (mFin ?? 0);

  while (cursorMin + DURACION_MIN <= finMin) {
    const inicio = new Date(anio, mes - 1, dia, Math.floor(cursorMin / 60), cursorMin % 60, 0, 0);
    const fin = new Date(inicio.getTime() + DURACION_MIN * 60 * 1000);
    slots.push({ inicio, fin });
    cursorMin += DURACION_MIN;
  }

  return slots;
}
