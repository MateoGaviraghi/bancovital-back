import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { doctor } from './doctor';
import { orderOriginEnum, orderStatusEnum } from './enums';
import { insurer } from './insurer';
import { laboratorio } from './laboratorio';
import { muestraAgua } from './muestra-agua';
import { pacienteAnimal } from './paciente-animal';
import { patient } from './patient';
import { servicio } from './servicio';
import { solicitanteAgua } from './solicitante-agua';
import { user } from './user';
import { veterinario } from './veterinario';

export const order = pgTable(
  'order',
  {
    id: bigint('id', { mode: 'number' })
      .primaryKey()
      .generatedByDefaultAsIdentity({ name: 'order_id_seq' }),
    labId: bigint('lab_id', { mode: 'number' })
      .notNull()
      .references(() => laboratorio.id, { onDelete: 'restrict' }),
    servicioId: bigint('servicio_id', { mode: 'number' })
      .notNull()
      .references(() => servicio.id, { onDelete: 'restrict' }),
    protocolNumber: bigint('protocol_number', { mode: 'number' })
      .notNull()
      .default(sql`nextval('seq_protocol')`),
    patientId: bigint('patient_id', { mode: 'number' }).references(() => patient.id, {
      onDelete: 'restrict',
    }),
    animalPatientId: bigint('animal_patient_id', { mode: 'number' }).references(
      () => pacienteAnimal.id,
      { onDelete: 'restrict' },
    ),
    veterinarioId: bigint('veterinario_id', { mode: 'number' }).references(
      () => veterinario.id,
      { onDelete: 'set null' },
    ),
    insurerId: bigint('insurer_id', { mode: 'number' })
      .notNull()
      .references(() => insurer.id, { onDelete: 'restrict' }),
    insuranceAffiliateNumber: text('insurance_affiliate_number'),
    referringDoctorId: bigint('referring_doctor_id', { mode: 'number' }).references(
      () => doctor.id,
      { onDelete: 'set null' },
    ),
    referringDoctorName: text('referring_doctor_name'),
    referringDoctorMp: text('referring_doctor_mp'),
    diagnosis: text('diagnosis'),
    origin: orderOriginEnum('origin').notNull(),
    orderDate: timestamp('order_date', { withTimezone: true }).notNull().defaultNow(),
    status: orderStatusEnum('status').notNull().default('borrador'),
    isUrgent: boolean('is_urgent').notNull().default(false),
    notes: text('notes'),
    cancellationReason: text('cancellation_reason'),
    totalParticular: numeric('total_particular', { precision: 12, scale: 2 })
      .notNull()
      .default('0.00'),
    totalInsurer: numeric('total_insurer', { precision: 12, scale: 2 }).notNull().default('0.00'),
    totalPatientCopay: numeric('total_patient_copay', { precision: 12, scale: 2 })
      .notNull()
      .default('0.00'),
    ubValueUsed: numeric('ub_value_used', { precision: 12, scale: 2 }).notNull(),
    pdfReportPath: text('pdf_report_path'),
    pdfReportIssuedAt: timestamp('pdf_report_issued_at', { withTimezone: true }),
    pdfReportRenderedAt: timestamp('pdf_report_rendered_at', { withTimezone: true }),
    pdfReportSignedBy: uuid('pdf_report_signed_by').references(() => user.id),
    createdBy: uuid('created_by').references(() => user.id),
    /** Marcado por ConsumoService al superar cupo+rollover (soft-block: nunca bloquea la operación) */
    esExcedente: boolean('es_excedente').notNull().default(false),
    /** F7 portal paciente: token unguessable (256-bit hex) embebido en el QR del informe. */
    publicReportToken: varchar('public_report_token', { length: 64 }),
    /** Intentos de DNI fallidos en el portal público (anti fuerza bruta). */
    publicAccessAttempts: integer('public_access_attempts').notNull().default(0),
    /** Bloqueo temporal del acceso público tras demasiados intentos fallidos de DNI. */
    publicAccessLockedUntil: timestamp('public_access_locked_until', { withTimezone: true }),
    customData: jsonb('custom_data'),
    solicitanteAguaId: bigint('solicitante_agua_id', { mode: 'number' }).references(
      () => solicitanteAgua.id,
      { onDelete: 'restrict' },
    ),
    muestraAguaId: bigint('muestra_agua_id', { mode: 'number' }).references(
      () => muestraAgua.id,
      { onDelete: 'restrict' },
    ),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    protocolIdx: uniqueIndex('idx_order_protocol').on(t.protocolNumber),
    patientDateIdx: index('idx_order_patient_date').on(t.patientId, t.orderDate),
    statusDateIdx: index('idx_order_status_date').on(t.status, t.orderDate),
    labStatusIdx: index('idx_order_lab_status').on(t.labId, t.status),
    animalPatientIdx: index('idx_order_animal_patient').on(t.animalPatientId),
    servicioIdx: index('idx_order_servicio').on(t.servicioId),
    // Lookup O(1) por token del portal público (múltiples NULL permitidos en PG).
    publicTokenIdx: uniqueIndex('idx_order_public_token').on(t.publicReportToken),
  }),
);

export type Order = typeof order.$inferSelect;
export type NewOrder = typeof order.$inferInsert;
