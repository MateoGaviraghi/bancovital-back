/**
 * Ancla el proceso a la zona horaria de Argentina (UTC-3).
 *
 * Por qué: las columnas `date` (ej. patient.birthDate) las parsea el driver de
 * Postgres usando la TZ local del proceso. Si el server corre en UTC, una fecha
 * como 1990-06-15 se interpreta a medianoche UTC y al formatearla en horario
 * argentino se "corre" un día. Forzando la TZ del proceso a Argentina, el parseo
 * y el formateo quedan alineados y las fechas/horas del PDF siempre salen en AR,
 * sin importar dónde se ejecute (Railway, local, etc.). Los timestamps
 * (timestamptz) ya son absolutos; esto cubre además los `date` puros y `new Date()`.
 *
 * IMPORTANTE: importar PRIMERO en main.ts, antes que cualquier otro módulo, para
 * que la TZ quede fijada antes de cualquier parseo de fechas.
 */
process.env.TZ = 'America/Argentina/Cordoba';
