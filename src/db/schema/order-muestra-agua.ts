import { bigint, integer, pgTable, text, timestamp, index } from 'drizzle-orm/pg-core';
import { order } from './order';
import { muestraAgua } from './muestra-agua';

export const orderMuestraAgua = pgTable(
  'order_muestra_agua',
  {
    id: bigint('id', { mode: 'number' })
      .primaryKey()
      .generatedByDefaultAsIdentity({ name: 'order_muestra_agua_id_seq' }),
    orderId: bigint('order_id', { mode: 'number' })
      .notNull()
      .references(() => order.id, { onDelete: 'cascade' }),
    muestraAguaId: bigint('muestra_agua_id', { mode: 'number' })
      .notNull()
      .references(() => muestraAgua.id, { onDelete: 'restrict' }),
    identificador: text('identificador'),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    orderIdx: index('idx_order_muestra_agua_order').on(t.orderId),
  }),
);

export type OrderMuestraAgua = typeof orderMuestraAgua.$inferSelect;
export type NewOrderMuestraAgua = typeof orderMuestraAgua.$inferInsert;
