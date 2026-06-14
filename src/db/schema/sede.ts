import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { laboratorio } from './laboratorio';

/**
 * Sede / ubicación física de un laboratorio (dirección, contacto, horarios).
 * Pertenece a un lab (multi-tenant). Metadata operativa sin FKs entrantes:
 * la FK hacia laboratorio es `cascade` (cae sola en el purge físico del lab,
 * igual que preferencia_pdf y anuncio). Soft-delete vía deletedAt.
 */
export const sede = pgTable(
  'sede',
  {
    id: bigint('id', { mode: 'number' })
      .primaryKey()
      .generatedByDefaultAsIdentity({ name: 'sede_id_seq' }),
    labId: bigint('lab_id', { mode: 'number' })
      .notNull()
      .references(() => laboratorio.id, { onDelete: 'cascade' }),
    nombre: text('nombre').notNull(),
    direccion: text('direccion').notNull(),
    localidad: text('localidad'),
    telefono: text('telefono'),
    email: text('email'),
    horarios: text('horarios'),
    /** Sede mostrada en el PDF de informes. A lo sumo una activa por lab. */
    principal: boolean('principal').notNull().default(false),
    /** Orden de presentación (menor primero). */
    orden: integer('orden').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => ({
    labIdx: index('idx_sede_lab').on(t.labId),
    // Garantiza a lo sumo UNA sede principal activa por laboratorio.
    principalActiveUnique: uniqueIndex('idx_sede_lab_principal_active')
      .on(t.labId)
      .where(sql`principal = true AND deleted_at IS NULL`),
  }),
);

export type Sede = typeof sede.$inferSelect;
export type NewSede = typeof sede.$inferInsert;
