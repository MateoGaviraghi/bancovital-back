import {
  bigint,
  index,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { especie } from './especie';
import { practice } from './practice';

/**
 * Valores de referencia de una práctica por especie.
 *
 * Una misma práctica (ej: Glucemia) puede tener rangos distintos según
 * la especie del animal. Para humanos se usa practice.referenceValue
 * (texto libre) y result.referenceRangeLow/High. Esta tabla agrega la
 * dimensión "especie" para veterinaria.
 *
 * UNIQUE (practice_id, especie_id) — un rango por práctica por especie.
 */
export const practiceReferenciaEspecie = pgTable(
  'practice_referencia_especie',
  {
    id: bigint('id', { mode: 'number' })
      .primaryKey()
      .generatedByDefaultAsIdentity({ name: 'practice_referencia_especie_id_seq' }),
    practiceId: bigint('practice_id', { mode: 'number' })
      .notNull()
      .references(() => practice.id, { onDelete: 'cascade' }),
    especieId: bigint('especie_id', { mode: 'number' })
      .notNull()
      .references(() => especie.id, { onDelete: 'cascade' }),
    rangeLow: numeric('range_low', { precision: 20, scale: 6 }),
    rangeHigh: numeric('range_high', { precision: 20, scale: 6 }),
    unit: text('unit'),
    referenceText: text('reference_text'),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    practiceEspecieUnique: uniqueIndex('idx_practice_ref_especie_unique').on(
      t.practiceId,
      t.especieId,
    ),
    practiceIdx: index('idx_practice_ref_especie_practice').on(t.practiceId),
    especieIdx: index('idx_practice_ref_especie_especie').on(t.especieId),
  }),
);

export type PracticeReferenciaEspecie = typeof practiceReferenciaEspecie.$inferSelect;
export type NewPracticeReferenciaEspecie = typeof practiceReferenciaEspecie.$inferInsert;
