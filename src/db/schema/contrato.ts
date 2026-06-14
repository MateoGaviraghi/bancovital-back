import {
  bigint,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  varchar,
} from 'drizzle-orm/pg-core';
import { laboratorio } from './laboratorio';
import { plan } from './plan';

export const contratoEstadoEnum = pgEnum('contrato_estado', [
  'enviado',
  'firmado',
  'vencido',
  'anulado',
]);

export const contrato = pgTable('contrato', {
  id: bigint('id', { mode: 'number' })
    .primaryKey()
    .generatedByDefaultAsIdentity({ name: 'contrato_id_seq' }),

  token: varchar('token', { length: 64 }).notNull().unique(),
  estado: contratoEstadoEnum('estado').notNull().default('enviado'),

  razonSocial: text('razon_social').notNull(),
  nombreContacto: text('nombre_contacto').notNull(),
  cuit: text('cuit'),
  emailFirmante: text('email_firmante').notNull(),
  telefono: text('telefono'),

  propuesta: jsonb('propuesta').notNull(),

  planSugeridoId: bigint('plan_sugerido_id', { mode: 'number' }).references(() => plan.id, {
    onDelete: 'set null',
  }),
  planElegidoId: bigint('plan_elegido_id', { mode: 'number' }).references(() => plan.id, {
    onDelete: 'set null',
  }),
  labCreadoId: bigint('lab_creado_id', { mode: 'number' }).references(() => laboratorio.id, {
    onDelete: 'set null',
  }),

  datosFacturacion: jsonb('datos_facturacion'),

  expiraAt: timestamp('expira_at', { withTimezone: true }).notNull(),

  pdfOriginalPath: text('pdf_original_path'),
  pdfFirmadoPath: text('pdf_firmado_path'),
  pdfHashSha256: text('pdf_hash_sha256'),

  otpHash: text('otp_hash'),
  otpExpiraAt: timestamp('otp_expira_at', { withTimezone: true }),
  otpIntentos: integer('otp_intentos').notNull().default(0),
  otpVerificadoAt: timestamp('otp_verificado_at', { withTimezone: true }),
  otpUltimoEnvioAt: timestamp('otp_ultimo_envio_at', { withTimezone: true }),

  evidencia: jsonb('evidencia'),
  firmadoAt: timestamp('firmado_at', { withTimezone: true }),

  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});

export type Contrato = typeof contrato.$inferSelect;
export type NewContrato = typeof contrato.$inferInsert;
