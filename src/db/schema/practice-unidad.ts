import {
  bigint,
  index,
  integer,
  pgTable,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { laboratorio } from './laboratorio';
import { practice } from './practice';
import { unidadMedida } from './unidad-medida';

/**
 * Pivot M:N práctica × unidad, scoped por laboratorio.
 * Una práctica global (NBU) puede tener distintos juegos de unidades en
 * distintos labs. Por eso `lab_id` viaja con la asociación.
 *
 * Reglas:
 * - UNIQUE (lab_id, practice_id, unidad_id) evita duplicados
 * - onDelete: restrict en practice/unidad impide borrar registros referenciados
 * - sort_order define el orden de los inputs en el form y en el PDF
 */
export const practiceUnidad = pgTable(
  'practice_unidad',
  {
    id: bigint('id', { mode: 'number' })
      .primaryKey()
      .generatedByDefaultAsIdentity({ name: 'practice_unidad_id_seq' }),
    labId: bigint('lab_id', { mode: 'number' })
      .notNull()
      .references(() => laboratorio.id, { onDelete: 'restrict' }),
    practiceId: bigint('practice_id', { mode: 'number' })
      .notNull()
      .references(() => practice.id, { onDelete: 'restrict' }),
    unidadId: bigint('unidad_id', { mode: 'number' })
      .notNull()
      .references(() => unidadMedida.id, { onDelete: 'restrict' }),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    uniqueLabPracticeUnidad: uniqueIndex('idx_practice_unidad_unique').on(
      t.labId,
      t.practiceId,
      t.unidadId,
    ),
    labPracticeIdx: index('idx_practice_unidad_lab_practice').on(t.labId, t.practiceId),
    unidadIdx: index('idx_practice_unidad_unidad').on(t.unidadId),
  }),
);

export type PracticeUnidad = typeof practiceUnidad.$inferSelect;
export type NewPracticeUnidad = typeof practiceUnidad.$inferInsert;
