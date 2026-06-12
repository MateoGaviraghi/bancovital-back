import { bigint, index, numeric, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { paymentMethodEnum } from './enums';
import { order } from './order';
import { user } from './user';

export const payment = pgTable(
  'payment',
  {
    id: bigint('id', { mode: 'number' })
      .primaryKey()
      .generatedByDefaultAsIdentity({ name: 'payment_id_seq' }),
    orderId: bigint('order_id', { mode: 'number' })
      .notNull()
      .references(() => order.id, { onDelete: 'cascade' }),
    method: paymentMethodEnum('method').notNull(),
    amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
    reference: text('reference'),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => user.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    orderIdx: index('idx_payment_order').on(t.orderId),
  }),
);

export type Payment = typeof payment.$inferSelect;
export type NewPayment = typeof payment.$inferInsert;
