import { bigint, numeric, pgTable, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { especie } from './especie';
import { practiceUnidad } from './practice-unidad';

/**
 * Override de rangos de referencia por especie para una asociación práctica↔unidad.
 * Si un lab atiende varias especies, cada unidad puede tener rangos distintos
 * por especie. Si no hay override, se usa el rango default de practice_unidad.
 */
export const practiceUnidadRefEspecie = pgTable(
  'practice_unidad_ref_especie',
  {
    id: bigint('id', { mode: 'number' })
      .primaryKey()
      .generatedByDefaultAsIdentity({ name: 'practice_unidad_ref_especie_id_seq' }),
    practiceUnidadId: bigint('practice_unidad_id', { mode: 'number' })
      .notNull()
      .references(() => practiceUnidad.id, { onDelete: 'cascade' }),
    especieId: bigint('especie_id', { mode: 'number' })
      .notNull()
      .references(() => especie.id, { onDelete: 'restrict' }),
    rangeLow: numeric('range_low', { precision: 12, scale: 4 }),
    rangeHigh: numeric('range_high', { precision: 12, scale: 4 }),
    referenceText: text('reference_text'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    uniquePracticeUnidadEspecie: uniqueIndex('idx_pu_ref_especie_unique').on(
      t.practiceUnidadId,
      t.especieId,
    ),
  }),
);

export type PracticeUnidadRefEspecie = typeof practiceUnidadRefEspecie.$inferSelect;
export type NewPracticeUnidadRefEspecie = typeof practiceUnidadRefEspecie.$inferInsert;
