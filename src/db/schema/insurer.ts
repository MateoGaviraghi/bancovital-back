import { bigint, boolean, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

export const insurer = pgTable('insurer', {
  id: bigint('id', { mode: 'number' })
    .primaryKey()
    .generatedByDefaultAsIdentity({ name: 'insurer_id_seq' }),
  code: text('code').notNull().unique(),
  name: text('name').notNull(),
  requiresAuthorization: boolean('requires_authorization').notNull().default(true),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type Insurer = typeof insurer.$inferSelect;
export type NewInsurer = typeof insurer.$inferInsert;
