import { bigint, index, integer, pgTable, text, uniqueIndex } from 'drizzle-orm/pg-core';
import { orderPractice } from './order-practice';
import { practice } from './practice';

export const antibiotico = pgTable('antibiotico', {
  id: bigint('id', { mode: 'number' })
    .primaryKey()
    .generatedByDefaultAsIdentity({ name: 'antibiotico_id_seq' }),
  nombre: text('nombre').notNull().unique(),
});

export const practiceAntibiograma = pgTable(
  'practice_antibiograma',
  {
    id: bigint('id', { mode: 'number' })
      .primaryKey()
      .generatedByDefaultAsIdentity({ name: 'practice_antibiograma_id_seq' }),
    practiceId: bigint('practice_id', { mode: 'number' })
      .notNull()
      .references(() => practice.id, { onDelete: 'cascade' }),
    antibioticoId: bigint('antibiotico_id', { mode: 'number' })
      .notNull()
      .references(() => antibiotico.id, { onDelete: 'restrict' }),
    sortOrder: integer('sort_order').notNull().default(0),
  },
  (t) => ({
    unique: uniqueIndex('idx_practice_antibiograma_unique').on(t.practiceId, t.antibioticoId),
    practiceIdx: index('idx_practice_antibiograma_practice').on(t.practiceId),
  }),
);

export const orderPracticeAntibiogramaResult = pgTable(
  'order_practice_antibiograma_result',
  {
    id: bigint('id', { mode: 'number' })
      .primaryKey()
      .generatedByDefaultAsIdentity({ name: 'order_practice_antibiograma_result_id_seq' }),
    orderPracticeId: bigint('order_practice_id', { mode: 'number' })
      .notNull()
      .references(() => orderPractice.id, { onDelete: 'cascade' }),
    antibioticoId: bigint('antibiotico_id', { mode: 'number' }).notNull(),
    antibioticoSnapshot: text('antibiotico_snapshot').notNull(),
    resultado: text('resultado'), // 'S' | 'I' | 'R' | null
    recuentoUfcMl: text('recuento_ufc_ml'),
  },
  (t) => ({
    opIdx: index('idx_order_practice_abg_op').on(t.orderPracticeId),
    unique: uniqueIndex('idx_order_practice_abg_unique').on(t.orderPracticeId, t.antibioticoId),
  }),
);

export type Antibiotico = typeof antibiotico.$inferSelect;
export type NewAntibiotico = typeof antibiotico.$inferInsert;
export type PracticeAntibiograma = typeof practiceAntibiograma.$inferSelect;
export type NewPracticeAntibiograma = typeof practiceAntibiograma.$inferInsert;
export type OrderPracticeAntibiogramaResult = typeof orderPracticeAntibiogramaResult.$inferSelect;
export type NewOrderPracticeAntibiogramaResult =
  typeof orderPracticeAntibiogramaResult.$inferInsert;
