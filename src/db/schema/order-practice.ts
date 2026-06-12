import {
  bigint,
  boolean,
  index,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';
import { authorizationStatusEnum } from './enums';
import { order } from './order';
import { practice } from './practice';

export const orderPractice = pgTable(
  'order_practice',
  {
    id: bigint('id', { mode: 'number' })
      .primaryKey()
      .generatedByDefaultAsIdentity({ name: 'order_practice_id_seq' }),
    orderId: bigint('order_id', { mode: 'number' })
      .notNull()
      .references(() => order.id, { onDelete: 'cascade' }),
    practiceId: bigint('practice_id', { mode: 'number' }).references(() => practice.id, {
      onDelete: 'restrict',
    }),
    nbuCodeSnapshot: text('nbu_code_snapshot').notNull(),
    nameSnapshot: text('name_snapshot').notNull(),
    unitsSnapshot: numeric('units_snapshot', { precision: 8, scale: 2 }).notNull(),
    ubValueSnapshot: numeric('ub_value_snapshot', { precision: 12, scale: 2 }).notNull(),
    priceParticular: numeric('price_particular', { precision: 12, scale: 2 }).notNull(),
    priceInsurer: numeric('price_insurer', { precision: 12, scale: 2 }).notNull(),
    patientCopay: numeric('patient_copay', { precision: 12, scale: 2 })
      .notNull()
      .default('0.00'),
    authorizationStatus: authorizationStatusEnum('authorization_status')
      .notNull()
      .default('no_aplica'),
    authorizationCode: text('authorization_code'),
    includeInReport: boolean('include_in_report').notNull().default(true),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    orderIdx: index('idx_order_practice_order').on(t.orderId),
  }),
);

export type OrderPractice = typeof orderPractice.$inferSelect;
export type NewOrderPractice = typeof orderPractice.$inferInsert;
