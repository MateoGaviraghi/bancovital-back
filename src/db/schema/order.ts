import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  index,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { doctor } from './doctor';
import { orderOriginEnum, orderStatusEnum } from './enums';
import { insurer } from './insurer';
import { laboratorio } from './laboratorio';
import { patient } from './patient';
import { user } from './user';

export const order = pgTable(
  'order',
  {
    id: bigint('id', { mode: 'number' })
      .primaryKey()
      .generatedByDefaultAsIdentity({ name: 'order_id_seq' }),
    labId: bigint('lab_id', { mode: 'number' })
      .notNull()
      .references(() => laboratorio.id, { onDelete: 'restrict' }),
    protocolNumber: bigint('protocol_number', { mode: 'number' })
      .notNull()
      .default(sql`nextval('seq_protocol')`),
    patientId: bigint('patient_id', { mode: 'number' })
      .notNull()
      .references(() => patient.id, { onDelete: 'restrict' }),
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
    totalInsurer: numeric('total_insurer', { precision: 12, scale: 2 })
      .notNull()
      .default('0.00'),
    totalPatientCopay: numeric('total_patient_copay', { precision: 12, scale: 2 })
      .notNull()
      .default('0.00'),
    ubValueUsed: numeric('ub_value_used', { precision: 12, scale: 2 }).notNull(),
    pdfReportPath: text('pdf_report_path'),
    pdfReportIssuedAt: timestamp('pdf_report_issued_at', { withTimezone: true }),
    pdfReportRenderedAt: timestamp('pdf_report_rendered_at', { withTimezone: true }),
    pdfReportSignedBy: uuid('pdf_report_signed_by').references(() => user.id),
    createdBy: uuid('created_by').references(() => user.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    protocolIdx: uniqueIndex('idx_order_protocol').on(t.protocolNumber),
    patientDateIdx: index('idx_order_patient_date').on(t.patientId, t.orderDate),
    statusDateIdx: index('idx_order_status_date').on(t.status, t.orderDate),
    labStatusIdx: index('idx_order_lab_status').on(t.labId, t.status),
  }),
);

export type Order = typeof order.$inferSelect;
export type NewOrder = typeof order.$inferInsert;
