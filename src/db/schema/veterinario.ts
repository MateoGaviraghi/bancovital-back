import { sql } from 'drizzle-orm';
import {
  bigint,
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { laboratorio } from './laboratorio';
import { user } from './user';

export const veterinario = pgTable(
  'veterinario',
  {
    id: bigint('id', { mode: 'number' })
      .primaryKey()
      .generatedByDefaultAsIdentity({ name: 'veterinario_id_seq' }),
    labId: bigint('lab_id', { mode: 'number' })
      .notNull()
      .references(() => laboratorio.id, { onDelete: 'restrict' }),
    firstName: text('first_name').notNull(),
    lastName: text('last_name').notNull(),
    matricula: text('matricula').notNull(),
    clinica: text('clinica'),
    phone: text('phone'),
    email: text('email'),
    notes: text('notes'),
    createdBy: uuid('created_by').references(() => user.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => ({
    matriculaActive: uniqueIndex('idx_veterinario_lab_matricula_active')
      .on(t.labId, t.matricula)
      .where(sql`deleted_at IS NULL`),
    lastNameTrgmIdx: index('idx_veterinario_lastname_trgm').using(
      'gin',
      sql`last_name gin_trgm_ops`,
    ),
    labIdx: index('idx_veterinario_lab').on(t.labId),
  }),
);

export type Veterinario = typeof veterinario.$inferSelect;
export type NewVeterinario = typeof veterinario.$inferInsert;
