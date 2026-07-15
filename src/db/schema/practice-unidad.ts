import { sql } from 'drizzle-orm';
import { bigint, index, integer, numeric, pgTable, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
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
    /** NULL = asociación global compartida por todos los labs. */
    labId: bigint('lab_id', { mode: 'number' }).references(() => laboratorio.id, {
      onDelete: 'restrict',
    }),
    practiceId: bigint('practice_id', { mode: 'number' })
      .notNull()
      .references(() => practice.id, { onDelete: 'restrict' }),
    unidadId: bigint('unidad_id', { mode: 'number' })
      .notNull()
      .references(() => unidadMedida.id, { onDelete: 'restrict' }),
    sortOrder: integer('sort_order').notNull().default(0),
    rangeLow: numeric('range_low', { precision: 12, scale: 4 }),
    rangeHigh: numeric('range_high', { precision: 12, scale: 4 }),
    referenceText: text('reference_text'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    globalUnique: uniqueIndex('idx_practice_unidad_global_unique')
      .on(t.practiceId, t.unidadId)
      .where(sql`lab_id IS NULL`),
    labUnique: uniqueIndex('idx_practice_unidad_lab_unique')
      .on(t.labId, t.practiceId, t.unidadId)
      .where(sql`lab_id IS NOT NULL`),
    labPracticeIdx: index('idx_practice_unidad_lab_practice').on(t.labId, t.practiceId),
    unidadIdx: index('idx_practice_unidad_unidad').on(t.unidadId),
  }),
);

export type PracticeUnidad = typeof practiceUnidad.$inferSelect;
export type NewPracticeUnidad = typeof practiceUnidad.$inferInsert;
