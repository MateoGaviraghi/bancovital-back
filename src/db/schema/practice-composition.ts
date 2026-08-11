import { bigint, index, integer, pgTable, uniqueIndex } from 'drizzle-orm/pg-core';
import { practice } from './practice';

export const practiceComposition = pgTable(
  'practice_composition',
  {
    id: bigint('id', { mode: 'number' })
      .primaryKey()
      .generatedByDefaultAsIdentity({ name: 'practice_composition_id_seq' }),
    parentPracticeId: bigint('parent_practice_id', { mode: 'number' })
      .notNull()
      .references(() => practice.id, { onDelete: 'cascade' }),
    componentPracticeId: bigint('component_practice_id', { mode: 'number' })
      .notNull()
      .references(() => practice.id, { onDelete: 'cascade' }),
    sortOrder: integer('sort_order').notNull().default(0),
  },
  (t) => ({
    unique: uniqueIndex('idx_practice_composition_unique').on(
      t.parentPracticeId,
      t.componentPracticeId,
    ),
    parentIdx: index('idx_practice_composition_parent').on(t.parentPracticeId),
    componentIdx: index('idx_practice_composition_component').on(t.componentPracticeId),
  }),
);

export type PracticeComposition = typeof practiceComposition.$inferSelect;
export type NewPracticeComposition = typeof practiceComposition.$inferInsert;
