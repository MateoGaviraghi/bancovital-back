import { bigint, integer, pgTable, timestamp, unique, varchar } from 'drizzle-orm/pg-core';
import { laboratorio } from './laboratorio';

/**
 * Ciclo de consumo mensual por laboratorio.
 * - cupo_base: null => sin plan (sin límite)
 * - rollover: no-usadas del mes anterior (vigencia 1 mes, no se encadena)
 * - usadas: órdenes registradas en el período
 * - excedentes: órdenes marcadas como excedentes facturables
 */
export const cicloConsumo = pgTable(
  'ciclo_consumo',
  {
    id: bigint('id', { mode: 'number' })
      .primaryKey()
      .generatedByDefaultAsIdentity({ name: 'ciclo_consumo_id_seq' }),
    labId: bigint('lab_id', { mode: 'number' })
      .notNull()
      .references(() => laboratorio.id, { onDelete: 'restrict' }),
    /** Formato 'YYYY-MM' */
    periodo: varchar('periodo', { length: 7 }).notNull(),
    /** null = sin plan en ese período (sin límite de cupo) */
    cupoBase: integer('cupo_base'),
    rollover: integer('rollover').notNull().default(0),
    usadas: integer('usadas').notNull().default(0),
    excedentes: integer('excedentes').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    uniqLabPeriodo: unique('uq_ciclo_consumo_lab_periodo').on(t.labId, t.periodo),
  }),
);

export type CicloConsumo = typeof cicloConsumo.$inferSelect;
export type NewCicloConsumo = typeof cicloConsumo.$inferInsert;
