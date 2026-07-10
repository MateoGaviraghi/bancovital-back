import {
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from 'drizzle-orm/pg-core';
import { laboratorio } from './laboratorio';

export const servicio = pgTable(
  'servicio',
  {
    id: bigint('id', { mode: 'number' })
      .primaryKey()
      .generatedByDefaultAsIdentity({ name: 'servicio_id_seq' }),
    labId: bigint('lab_id', { mode: 'number' })
      .notNull()
      .references(() => laboratorio.id, { onDelete: 'cascade' }),
    nombre: text('nombre').notNull(),
    slug: varchar('slug', { length: 100 }).notNull(),
    icono: text('icono'),
    orden: integer('orden').notNull().default(0),
    activo: boolean('activo').notNull().default(true),
    usaPacienteHumano: boolean('usa_paciente_humano').notNull().default(false),
    usaPacienteAnimal: boolean('usa_paciente_animal').notNull().default(false),
    usaMedico: boolean('usa_medico').notNull().default(false),
    usaVeterinario: boolean('usa_veterinario').notNull().default(false),
    usaPropietario: boolean('usa_propietario').notNull().default(false),
    usaSolicitanteAgua: boolean('usa_solicitante_agua').notNull().default(false),
    usaMuestraAgua: boolean('usa_muestra_agua').notNull().default(false),
    formConfig: jsonb('form_config'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    labSlugUnique: uniqueIndex('idx_servicio_lab_slug').on(t.labId, t.slug),
    labOrdenIdx: index('idx_servicio_lab_orden').on(t.labId, t.orden),
  }),
);

export type Servicio = typeof servicio.$inferSelect;
export type NewServicio = typeof servicio.$inferInsert;

export type FormFieldType = 'text' | 'textarea' | 'number' | 'select' | 'checkbox' | 'date' | 'datetime' | 'email';

export interface FormFieldConfig {
  key: string;
  label: string;
  type: FormFieldType;
  required?: boolean;
  options?: string[];
  placeholder?: string;
  colSpan?: 1 | 2;
}

export interface FormSectionConfig {
  key: string;
  title: string;
  fields: FormFieldConfig[];
}

export interface ServicioFormConfig {
  sections: FormSectionConfig[];
}
