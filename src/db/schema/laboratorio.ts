import { bigint, boolean, pgTable, text, timestamp, varchar } from 'drizzle-orm/pg-core';
import { estadoLabEnum } from './enums';

export const laboratorio = pgTable('laboratorio', {
  id: bigint('id', { mode: 'number' })
    .primaryKey()
    .generatedByDefaultAsIdentity({ name: 'laboratorio_id_seq' }),
  slug: varchar('slug', { length: 63 }).notNull().unique(),
  legalName: text('legal_name').notNull(),
  shortName: text('short_name'),
  cuit: text('cuit'),
  streetAddress: text('street_address'),
  city: text('city').default('Santa Fe'),
  province: text('province').default('Santa Fe'),
  phone: text('phone'),
  email: text('email'),
  signingProfessionalName: text('signing_professional_name'),
  signingProfessionalMp: text('signing_professional_mp'),
  signingSignaturePath: text('signing_signature_path'),
  logoPath: text('logo_path'),
  primaryColor: text('primary_color'),
  accentColor: text('accent_color'),
  tagline: text('tagline'),
  estado: estadoLabEnum('estado').notNull().default('activo'),
  /** Marcado manual por el super: lab moroso (deuda impaga). Solo informativo. */
  moroso: boolean('moroso').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type Laboratorio = typeof laboratorio.$inferSelect;
export type NewLaboratorio = typeof laboratorio.$inferInsert;
