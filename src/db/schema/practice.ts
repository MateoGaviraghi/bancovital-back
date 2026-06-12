import type { ReferenceValueTemplate } from '@/domain/validation/validation';
import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  index,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

export type { ReferenceValueTemplate } from '@/domain/validation/validation';

export const practice = pgTable(
  'practice',
  {
    id: bigint('id', { mode: 'number' })
      .primaryKey()
      .generatedByDefaultAsIdentity({ name: 'practice_id_seq' }),
    nbuCode: text('nbu_code').notNull(),
    name: text('name').notNull(),
    shortName: text('short_name'),
    category: text('category'),
    section: text('section'),
    units: numeric('units', { precision: 8, scale: 2 }),
    notes: text('notes'),
    requiresAuthorization: boolean('requires_authorization').notNull().default(false),
    referenceValueTemplate: jsonb('reference_value_template').$type<ReferenceValueTemplate>(),
    isSpecialAct: boolean('is_special_act').notNull().default(false),
    active: boolean('active').notNull().default(true),
    /** Si no es null, esta practica es hija de la practica con este id. */
    parentId: bigint('parent_id', { mode: 'number' }),
    /** Texto libre con valores de referencia orientativos para el bioquimico. */
    referenceValue: text('reference_value'),
    /** Metodologia por defecto para esta practica (se muestra en el PDF). */
    methodology: text('methodology'),
    /** true = el laboratorio la elabora; false = se deriva a otro laboratorio. */
    isElaborated: boolean('is_elaborated').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    nbuCodeIdx: uniqueIndex('idx_practice_nbucode').on(t.nbuCode),
    sectionActiveIdx: index('idx_practice_active_section').on(t.active, t.section),
    nameTrgmIdx: index('idx_practice_name_trgm').using('gin', sql`name gin_trgm_ops`),
  }),
);

export type Practice = typeof practice.$inferSelect;
export type NewPractice = typeof practice.$inferInsert;
