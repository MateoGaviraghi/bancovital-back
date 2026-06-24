import { bigint, pgTable, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { laboratorio } from './laboratorio';
import { practice } from './practice';

/**
 * Configuración per-lab de una práctica global.
 * El catálogo NBU (código, nombre, UB, sección) es compartido por todos los labs.
 * Cada lab puede personalizar: metodología, valores de referencia y notas internas.
 * UNIQUE(lab_id, practice_id) garantiza una sola config por lab+práctica.
 */
export const labPracticeConfig = pgTable(
  'lab_practice_config',
  {
    id: bigint('id', { mode: 'number' })
      .primaryKey()
      .generatedByDefaultAsIdentity({ name: 'lab_practice_config_id_seq' }),
    labId: bigint('lab_id', { mode: 'number' })
      .notNull()
      .references(() => laboratorio.id, { onDelete: 'cascade' }),
    practiceId: bigint('practice_id', { mode: 'number' })
      .notNull()
      .references(() => practice.id, { onDelete: 'cascade' }),
    methodology: text('methodology'),
    referenceValue: text('reference_value'),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    uniqueLabPractice: uniqueIndex('idx_lab_practice_config_unique').on(t.labId, t.practiceId),
  }),
);

export type LabPracticeConfig = typeof labPracticeConfig.$inferSelect;
export type NewLabPracticeConfig = typeof labPracticeConfig.$inferInsert;
