import { sql } from 'drizzle-orm';
import {
  bigint,
  date,
  index,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { animalSexEnum, reproductiveStatusEnum } from './enums';
import { especie } from './especie';
import { laboratorio } from './laboratorio';
import { propietario } from './propietario';
import { raza } from './raza';
import { user } from './user';

export const pacienteAnimal = pgTable(
  'paciente_animal',
  {
    id: bigint('id', { mode: 'number' })
      .primaryKey()
      .generatedByDefaultAsIdentity({ name: 'paciente_animal_id_seq' }),
    labId: bigint('lab_id', { mode: 'number' })
      .notNull()
      .references(() => laboratorio.id, { onDelete: 'restrict' }),
    propietarioId: bigint('propietario_id', { mode: 'number' })
      .notNull()
      .references(() => propietario.id, { onDelete: 'restrict' }),
    especieId: bigint('especie_id', { mode: 'number' })
      .notNull()
      .references(() => especie.id, { onDelete: 'restrict' }),
    razaId: bigint('raza_id', { mode: 'number' }).references(() => raza.id, {
      onDelete: 'set null',
    }),
    nombre: text('nombre').notNull(),
    sexo: animalSexEnum('sexo'),
    birthDate: date('birth_date', { mode: 'date' }),
    peso: numeric('peso', { precision: 8, scale: 2 }),
    color: text('color'),
    tamanio: text('tamanio'),
    estadoReproductivo: reproductiveStatusEnum('estado_reproductivo'),
    microchip: text('microchip'),
    notes: text('notes'),
    createdBy: uuid('created_by').references(() => user.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => ({
    labIdx: index('idx_paciente_animal_lab').on(t.labId),
    propietarioIdx: index('idx_paciente_animal_propietario').on(t.propietarioId),
    especieIdx: index('idx_paciente_animal_especie').on(t.especieId),
    nombreTrgmIdx: index('idx_paciente_animal_nombre_trgm').using(
      'gin',
      sql`nombre gin_trgm_ops`,
    ),
  }),
);

export type PacienteAnimal = typeof pacienteAnimal.$inferSelect;
export type NewPacienteAnimal = typeof pacienteAnimal.$inferInsert;
