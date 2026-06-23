import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

export const especie = pgTable(
  'especie',
  {
    id: bigint('id', { mode: 'number' })
      .primaryKey()
      .generatedByDefaultAsIdentity({ name: 'especie_id_seq' }),
    nombre: text('nombre').notNull(),
    nombreCientifico: text('nombre_cientifico'),
    active: boolean('active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    nombreUnique: uniqueIndex('idx_especie_nombre').on(sql`lower(${t.nombre})`),
    activeIdx: index('idx_especie_active').on(t.active),
  }),
);

export type Especie = typeof especie.$inferSelect;
export type NewEspecie = typeof especie.$inferInsert;
