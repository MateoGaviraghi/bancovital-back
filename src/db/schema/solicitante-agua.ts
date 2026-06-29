import {
  bigint,
  index,
  pgTable,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';
import { laboratorio } from './laboratorio';

export const solicitanteAgua = pgTable(
  'solicitante_agua',
  {
    id: bigint('id', { mode: 'number' })
      .primaryKey()
      .generatedByDefaultAsIdentity({ name: 'solicitante_agua_id_seq' }),
    labId: bigint('lab_id', { mode: 'number' })
      .notNull()
      .references(() => laboratorio.id, { onDelete: 'cascade' }),
    nombreApellido: text('nombre_apellido').notNull(),
    razonSocial: text('razon_social'),
    cuit: text('cuit'),
    domicilio: text('domicilio'),
    localidad: text('localidad'),
    provincia: text('provincia'),
    telefono: text('telefono'),
    email: text('email'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => ({
    labIdx: index('idx_solicitante_agua_lab').on(t.labId),
  }),
);

export type SolicitanteAgua = typeof solicitanteAgua.$inferSelect;
export type NewSolicitanteAgua = typeof solicitanteAgua.$inferInsert;
