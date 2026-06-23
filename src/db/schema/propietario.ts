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

export const propietario = pgTable(
  'propietario',
  {
    id: bigint('id', { mode: 'number' })
      .primaryKey()
      .generatedByDefaultAsIdentity({ name: 'propietario_id_seq' }),
    labId: bigint('lab_id', { mode: 'number' })
      .notNull()
      .references(() => laboratorio.id, { onDelete: 'restrict' }),
    dni: text('dni').notNull(),
    firstName: text('first_name').notNull(),
    lastName: text('last_name').notNull(),
    phone: text('phone'),
    email: text('email'),
    streetAddress: text('street_address'),
    city: text('city'),
    notes: text('notes'),
    createdBy: uuid('created_by').references(() => user.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => ({
    dniUniqueActive: uniqueIndex('idx_propietario_lab_dni_active')
      .on(t.labId, t.dni)
      .where(sql`deleted_at IS NULL`),
    lastNameTrgmIdx: index('idx_propietario_lastname_trgm').using(
      'gin',
      sql`last_name gin_trgm_ops`,
    ),
    labIdx: index('idx_propietario_lab').on(t.labId),
  }),
);

export type Propietario = typeof propietario.$inferSelect;
export type NewPropietario = typeof propietario.$inferInsert;
