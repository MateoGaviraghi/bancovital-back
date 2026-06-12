import {
  bigint,
  index,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { orderPractice } from './order-practice';
import { unidadMedida } from './unidad-medida';
import { user } from './user';

/**
 * Valor cargado para una unidad específica dentro de la línea de la orden.
 *
 * Snapshot del nombre/símbolo al momento de carga: el PDF debe ser inmutable
 * frente a renombres posteriores del catálogo (mismo criterio que ya usan
 * order_practice.name_snapshot y nbu_code_snapshot).
 *
 * Único por (order_practice_id, unidad_id) → un valor por unidad por línea.
 */
export const orderPracticeUnidadValue = pgTable(
  'order_practice_unidad_value',
  {
    id: bigint('id', { mode: 'number' })
      .primaryKey()
      .generatedByDefaultAsIdentity({ name: 'order_practice_unidad_value_id_seq' }),
    orderPracticeId: bigint('order_practice_id', { mode: 'number' })
      .notNull()
      .references(() => orderPractice.id, { onDelete: 'cascade' }),
    unidadId: bigint('unidad_id', { mode: 'number' })
      .notNull()
      .references(() => unidadMedida.id, { onDelete: 'restrict' }),
    unidadNombreSnapshot: text('unidad_nombre_snapshot').notNull(),
    unidadSimboloSnapshot: text('unidad_simbolo_snapshot'),
    valueNumeric: numeric('value_numeric', { precision: 20, scale: 6 }),
    valueText: text('value_text'),
    notes: text('notes'),
    enteredBy: uuid('entered_by')
      .notNull()
      .references(() => user.id),
    enteredAt: timestamp('entered_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    uniqueOpUnidad: uniqueIndex('idx_op_unidad_value_unique').on(t.orderPracticeId, t.unidadId),
    opIdx: index('idx_op_unidad_value_op').on(t.orderPracticeId),
  }),
);

export type OrderPracticeUnidadValue = typeof orderPracticeUnidadValue.$inferSelect;
export type NewOrderPracticeUnidadValue = typeof orderPracticeUnidadValue.$inferInsert;
