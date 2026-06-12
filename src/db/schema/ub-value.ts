import { sql } from 'drizzle-orm';
import {
  bigint,
  date,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { insurer } from './insurer';
import { user } from './user';

export const ubValue = pgTable(
  'ub_value',
  {
    id: bigint('id', { mode: 'number' })
      .primaryKey()
      .generatedByDefaultAsIdentity({ name: 'ub_value_id_seq' }),
    insurerId: bigint('insurer_id', { mode: 'number' })
      .notNull()
      .references(() => insurer.id, { onDelete: 'restrict' }),
    validFrom: date('valid_from', { mode: 'date' }).notNull(),
    validTo: date('valid_to', { mode: 'date' }),
    value: numeric('value', { precision: 12, scale: 2 }).notNull(),
    notes: text('notes'),
    createdBy: uuid('created_by').references(() => user.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    currentPerInsurer: uniqueIndex('idx_ubvalue_current_per_insurer')
      .on(t.insurerId)
      .where(sql`valid_to IS NULL`),
  }),
);

export type UbValue = typeof ubValue.$inferSelect;
export type NewUbValue = typeof ubValue.$inferInsert;
