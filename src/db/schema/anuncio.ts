import { bigint, boolean, index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { anuncioTipoEnum } from './enums';
import { laboratorio } from './laboratorio';

/**
 * Anuncios del sistema (Nodo → labs).
 * - labId null  => anuncio global (aplica a todos los labs y al super).
 * - labId set   => anuncio dirigido a un lab específico.
 * Vigencia opcional vía desde/hasta. Soft-delete via deletedAt.
 */
export const anuncio = pgTable(
  'anuncio',
  {
    id: bigint('id', { mode: 'number' })
      .primaryKey()
      .generatedByDefaultAsIdentity({ name: 'anuncio_id_seq' }),
    mensaje: text('mensaje').notNull(),
    tipo: anuncioTipoEnum('tipo').notNull().default('info'),
    labId: bigint('lab_id', { mode: 'number' }).references(() => laboratorio.id, {
      onDelete: 'cascade',
    }),
    activo: boolean('activo').notNull().default(true),
    desde: timestamp('desde', { withTimezone: true }),
    hasta: timestamp('hasta', { withTimezone: true }),
    createdBy: uuid('created_by'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => ({
    labIdx: index('idx_anuncio_lab').on(t.labId),
  }),
);

export type Anuncio = typeof anuncio.$inferSelect;
export type NewAnuncio = typeof anuncio.$inferInsert;
