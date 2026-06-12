import { bigint, numeric, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { resultFlagEnum } from './enums';
import { orderPractice } from './order-practice';
import { user } from './user';

export const result = pgTable('result', {
  id: bigint('id', { mode: 'number' })
    .primaryKey()
    .generatedByDefaultAsIdentity({ name: 'result_id_seq' }),
  orderPracticeId: bigint('order_practice_id', { mode: 'number' })
    .notNull()
    .unique()
    .references(() => orderPractice.id, { onDelete: 'cascade' }),
  valueNumeric: numeric('value_numeric', { precision: 20, scale: 6 }),
  valueText: text('value_text'),
  unit: text('unit'),
  referenceRangeLow: numeric('reference_range_low', { precision: 20, scale: 6 }),
  referenceRangeHigh: numeric('reference_range_high', { precision: 20, scale: 6 }),
  flag: resultFlagEnum('flag'),
  methodology: text('methodology'),
  notes: text('notes'),
  enteredBy: uuid('entered_by')
    .notNull()
    .references(() => user.id),
  enteredAt: timestamp('entered_at', { withTimezone: true }).notNull().defaultNow(),
  reviewedBy: uuid('reviewed_by').references(() => user.id),
  reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
});

export type Result = typeof result.$inferSelect;
export type NewResult = typeof result.$inferInsert;
