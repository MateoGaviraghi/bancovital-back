import { bigint, integer, numeric, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { cotizacion } from './cotizacion';
import { practice } from './practice';

export const cotizacionItem = pgTable('cotizacion_item', {
  id: bigint('id', { mode: 'number' })
    .primaryKey()
    .generatedByDefaultAsIdentity({ name: 'cotizacion_item_id_seq' }),
  cotizacionId: bigint('cotizacion_id', { mode: 'number' })
    .notNull()
    .references(() => cotizacion.id, { onDelete: 'cascade' }),
  /** Null si el ítem fue ingresado manualmente (sin práctica del catálogo). */
  practiceId: bigint('practice_id', { mode: 'number' }).references(() => practice.id, {
    onDelete: 'set null',
  }),
  /** Snapshot del nombre al momento de crear la cotización. */
  practicaNombre: text('practica_nombre').notNull(),
  precioUnitario: numeric('precio_unitario', { precision: 12, scale: 2 }).notNull(),
  cantidad: integer('cantidad').notNull().default(1),
  subtotal: numeric('subtotal', { precision: 12, scale: 2 }).notNull(),
  sort: integer('sort').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type CotizacionItem = typeof cotizacionItem.$inferSelect;
export type NewCotizacionItem = typeof cotizacionItem.$inferInsert;
