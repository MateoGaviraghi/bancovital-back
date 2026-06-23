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
import { especie } from './especie';

export const raza = pgTable(
  'raza',
  {
    id: bigint('id', { mode: 'number' })
      .primaryKey()
      .generatedByDefaultAsIdentity({ name: 'raza_id_seq' }),
    especieId: bigint('especie_id', { mode: 'number' })
      .notNull()
      .references(() => especie.id, { onDelete: 'restrict' }),
    nombre: text('nombre').notNull(),
    active: boolean('active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    especieNombreUnique: uniqueIndex('idx_raza_especie_nombre').on(
      t.especieId,
      sql`lower(${t.nombre})`,
    ),
    especieIdx: index('idx_raza_especie').on(t.especieId),
  }),
);

export type Raza = typeof raza.$inferSelect;
export type NewRaza = typeof raza.$inferInsert;
