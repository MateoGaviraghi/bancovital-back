import { bigint, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

export const labConfig = pgTable('lab_config', {
  id: bigint('id', { mode: 'number' })
    .primaryKey()
    .generatedByDefaultAsIdentity({ name: 'lab_config_id_seq' }),
  legalName: text('legal_name').notNull(),
  cuit: text('cuit').notNull(),
  streetAddress: text('street_address').notNull(),
  city: text('city').notNull().default('Santa Fe'),
  province: text('province').notNull().default('Santa Fe'),
  phone: text('phone'),
  email: text('email'),
  signingProfessionalName: text('signing_professional_name').notNull(),
  signingProfessionalMp: text('signing_professional_mp').notNull(),
  signingSignaturePath: text('signing_signature_path'),
  logoUrl: text('logo_url'),
  shortName: text('short_name'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type LabConfig = typeof labConfig.$inferSelect;
export type NewLabConfig = typeof labConfig.$inferInsert;
