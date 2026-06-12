import { bigint, boolean, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { userRoleEnum } from './enums';
import { laboratorio } from './laboratorio';

export const user = pgTable('user', {
  id: uuid('id').primaryKey(),
  labId: bigint('lab_id', { mode: 'number' })
    .references(() => laboratorio.id, { onDelete: 'restrict' }),
  email: text('email').notNull(),
  displayName: text('display_name'),
  role: userRoleEnum('role').notNull(),
  matricula: text('matricula'),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type User = typeof user.$inferSelect;
export type NewUser = typeof user.$inferInsert;
