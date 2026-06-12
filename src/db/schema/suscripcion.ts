import { sql } from 'drizzle-orm';
import { bigint, pgTable, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { suscripcionEstadoEnum } from './enums';
import { laboratorio } from './laboratorio';
import { plan } from './plan';

/**
 * Suscripción de un laboratorio a un plan.
 * Índice único parcial garantiza un solo registro activo por lab.
 */
export const suscripcion = pgTable(
  'suscripcion',
  {
    id: bigint('id', { mode: 'number' })
      .primaryKey()
      .generatedByDefaultAsIdentity({ name: 'suscripcion_id_seq' }),
    labId: bigint('lab_id', { mode: 'number' })
      .notNull()
      .references(() => laboratorio.id, { onDelete: 'restrict' }),
    planId: bigint('plan_id', { mode: 'number' })
      .notNull()
      .references(() => plan.id, { onDelete: 'restrict' }),
    estado: suscripcionEstadoEnum('estado').notNull().default('activa'),
    desde: timestamp('desde', { withTimezone: true }).notNull().defaultNow(),
    hasta: timestamp('hasta', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    /** Solo un registro activo por lab */
    unicaActiva: uniqueIndex('idx_suscripcion_unica_activa')
      .on(t.labId)
      .where(sql`estado = 'activa'`),
  }),
);

export type Suscripcion = typeof suscripcion.$inferSelect;
export type NewSuscripcion = typeof suscripcion.$inferInsert;
