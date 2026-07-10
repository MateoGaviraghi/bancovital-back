import { sql } from 'drizzle-orm';
import {
  bigint,
  index,
  numeric,
  pgTable,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { insurer } from './insurer';
import { laboratorio } from './laboratorio';
import { practice } from './practice';

/**
 * Catálogo de precios por práctica × obra social (o precio particular cuando
 * insurer_id IS NULL). Scoped por lab.
 */
export const cotizacionPrecio = pgTable(
  'cotizacion_precio',
  {
    id: bigint('id', { mode: 'number' })
      .primaryKey()
      .generatedByDefaultAsIdentity({ name: 'cotizacion_precio_id_seq' }),
    labId: bigint('lab_id', { mode: 'number' })
      .notNull()
      .references(() => laboratorio.id, { onDelete: 'cascade' }),
    practiceId: bigint('practice_id', { mode: 'number' })
      .notNull()
      .references(() => practice.id, { onDelete: 'cascade' }),
    /** NULL = precio particular (sin obra social). */
    insurerId: bigint('insurer_id', { mode: 'number' }).references(() => insurer.id, {
      onDelete: 'cascade',
    }),
    precio: numeric('precio', { precision: 12, scale: 2 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    labPracticeInsIdx: uniqueIndex('idx_cotprecio_insurer')
      .on(t.labId, t.practiceId, t.insurerId)
      .where(sql`insurer_id IS NOT NULL`),
    labPracticeDefaultIdx: uniqueIndex('idx_cotprecio_default')
      .on(t.labId, t.practiceId)
      .where(sql`insurer_id IS NULL`),
    labIdx: index('idx_cotprecio_lab').on(t.labId),
    practiceIdx: index('idx_cotprecio_practice').on(t.practiceId),
  }),
);

export type CotizacionPrecio = typeof cotizacionPrecio.$inferSelect;
export type NewCotizacionPrecio = typeof cotizacionPrecio.$inferInsert;
