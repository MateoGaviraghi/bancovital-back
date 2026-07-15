import { bigint, index, numeric, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { cotizacionEstadoEnum, cotizacionTipoEnum } from './enums';
import { insurer } from './insurer';
import { laboratorio } from './laboratorio';
import { patient } from './patient';
import { user } from './user';

export const cotizacion = pgTable(
  'cotizacion',
  {
    id: bigint('id', { mode: 'number' })
      .primaryKey()
      .generatedByDefaultAsIdentity({ name: 'cotizacion_id_seq' }),
    labId: bigint('lab_id', { mode: 'number' })
      .notNull()
      .references(() => laboratorio.id, { onDelete: 'cascade' }),
    tipo: cotizacionTipoEnum('tipo').notNull(),
    estado: cotizacionEstadoEnum('estado').notNull().default('borrador'),
    /** FK patient cuando tipo = 'paciente'. */
    patientId: bigint('patient_id', { mode: 'number' }).references(() => patient.id, {
      onDelete: 'restrict',
    }),
    /** Campos para tipo = 'empresa'. */
    empresaNombre: text('empresa_nombre'),
    empresaCuit: text('empresa_cuit'),
    empresaEmail: text('empresa_email'),
    empresaTelefono: text('empresa_telefono'),
    empresaContacto: text('empresa_contacto'),
    /** Obra social aplicada para esta cotización (determina precio). NULL = particular. */
    insurerId: bigint('insurer_id', { mode: 'number' }).references(() => insurer.id, {
      onDelete: 'restrict',
    }),
    totalMonto: numeric('total_monto', { precision: 12, scale: 2 }).notNull().default('0'),
    /** Porcentaje de copago a cargo del paciente. NULL = OS cubre 100%. */
    copagoPorc: numeric('copago_porc', { precision: 5, scale: 2 }),
    validezDias: integer('validez_dias').notNull().default(30),
    observaciones: text('observaciones'),
    createdBy: uuid('created_by').references(() => user.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => ({
    labIdx: index('idx_cotizacion_lab').on(t.labId),
    estadoIdx: index('idx_cotizacion_estado').on(t.estado),
    patientIdx: index('idx_cotizacion_patient').on(t.patientId),
  }),
);

export type Cotizacion = typeof cotizacion.$inferSelect;
export type NewCotizacion = typeof cotizacion.$inferInsert;
