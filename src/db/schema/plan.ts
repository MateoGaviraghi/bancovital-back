import { bigint, integer, numeric, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

/**
 * Catálogo global de planes (Nodo). Sin labId — es cross-tenant.
 * Soft-delete via deletedAt.
 */
export const plan = pgTable('plan', {
  id: bigint('id', { mode: 'number' })
    .primaryKey()
    .generatedByDefaultAsIdentity({ name: 'plan_id_seq' }),
  nombre: text('nombre').notNull().unique(),
  cupoOrdenesMes: integer('cupo_ordenes_mes').notNull(),
  precioMensual: numeric('precio_mensual', { precision: 12, scale: 2 }).notNull(),
  precioOrdenExcedente: numeric('precio_orden_excedente', { precision: 12, scale: 2 }).notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type Plan = typeof plan.$inferSelect;
export type NewPlan = typeof plan.$inferInsert;
