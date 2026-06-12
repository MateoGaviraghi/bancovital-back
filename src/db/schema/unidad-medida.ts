import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { laboratorio } from './laboratorio';
import { user } from './user';

/**
 * Catálogo per-tenant de "unidades" reutilizables que se asocian a prácticas.
 * El cliente las llama "unidades de medida" pero pueden representar tanto
 * unidades físicas (mg/dL, %, U/L) como sub-componentes de una práctica
 * multi-analito (p.ej. en Orina Completa: pH, Densidad, Leucocitos, ...).
 *
 * Único por (lab_id, lower(nombre)) para que cada laboratorio gestione
 * su propio catálogo sin chocar con otros tenants.
 */
export const unidadMedida = pgTable(
  'unidad_medida',
  {
    id: bigint('id', { mode: 'number' })
      .primaryKey()
      .generatedByDefaultAsIdentity({ name: 'unidad_medida_id_seq' }),
    labId: bigint('lab_id', { mode: 'number' })
      .notNull()
      .references(() => laboratorio.id, { onDelete: 'restrict' }),
    nombre: text('nombre').notNull(),
    simbolo: text('simbolo'),
    active: boolean('active').notNull().default(true),
    createdBy: uuid('created_by').references(() => user.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    labNombreUnique: uniqueIndex('idx_unidad_medida_lab_nombre').on(
      t.labId,
      sql`lower(${t.nombre})`,
    ),
    labActiveIdx: index('idx_unidad_medida_lab_active').on(t.labId, t.active),
    nombreTrgmIdx: index('idx_unidad_medida_nombre_trgm').using('gin', sql`nombre gin_trgm_ops`),
  }),
);

export type UnidadMedida = typeof unidadMedida.$inferSelect;
export type NewUnidadMedida = typeof unidadMedida.$inferInsert;
