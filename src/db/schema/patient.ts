import { sql } from 'drizzle-orm';
import {
  bigint,
  date,
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { patientSexEnum } from './enums';
import { laboratorio } from './laboratorio';
import { user } from './user';

export const patient = pgTable(
  'patient',
  {
    id: bigint('id', { mode: 'number' })
      .primaryKey()
      .generatedByDefaultAsIdentity({ name: 'patient_id_seq' }),
    labId: bigint('lab_id', { mode: 'number' })
      .notNull()
      .references(() => laboratorio.id, { onDelete: 'restrict' }),
    dni: text('dni').notNull(),
    firstName: text('first_name').notNull(),
    lastName: text('last_name').notNull(),
    sex: patientSexEnum('sex'),
    birthDate: date('birth_date', { mode: 'date' }),
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
    dniUniqueActive: uniqueIndex('idx_patient_lab_dni_active')
      .on(t.labId, t.dni)
      .where(sql`deleted_at IS NULL`),
    emailIdx: index('idx_patient_email').on(t.email),
    lastNameTrgmIdx: index('idx_patient_lastname_trgm').using('gin', sql`last_name gin_trgm_ops`),
    labIdx: index('idx_patient_lab').on(t.labId),
  }),
);

export type Patient = typeof patient.$inferSelect;
export type NewPatient = typeof patient.$inferInsert;
