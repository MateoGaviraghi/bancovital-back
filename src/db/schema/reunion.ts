import { sql } from 'drizzle-orm';
import {
  bigint,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from 'drizzle-orm/pg-core';

export const reunionEstadoEnum = pgEnum('reunion_estado', ['confirmada', 'cancelada']);

export const reunion = pgTable(
  'reunion',
  {
    id: bigint('id', { mode: 'number' })
      .primaryKey()
      .generatedByDefaultAsIdentity({ name: 'reunion_id_seq' }),

    nombre: text('nombre').notNull(),
    email: text('email').notNull(),
    empresa: text('empresa'),
    telefono: text('telefono'),
    mensaje: text('mensaje'),

    slotInicio: timestamp('slot_inicio', { withTimezone: true }).notNull(),
    slotFin: timestamp('slot_fin', { withTimezone: true }).notNull(),

    estado: reunionEstadoEnum('estado').notNull().default('confirmada'),

    /** Token de 32 bytes aleatorios (hex) para confirmar/cancelar desde email. */
    token: varchar('token', { length: 64 }).notNull().unique(),

    /** Timestamp cuando el invitado confirmó asistencia desde el link del email. */
    asistenciaConfirmadaAt: timestamp('asistencia_confirmada_at', { withTimezone: true }),

    googleEventId: text('google_event_id'),
    meetLink: text('meet_link'),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    /**
     * Índice único parcial: solo un slot_inicio confirmado puede existir a la vez.
     * Previene doble-reserva del mismo slot a nivel DB.
     */
    slotInicioConfirmadaIdx: uniqueIndex('reunion_slot_inicio_confirmada_idx')
      .on(t.slotInicio)
      .where(sql`estado = 'confirmada'`),
  }),
);

export type Reunion = typeof reunion.$inferSelect;
export type NewReunion = typeof reunion.$inferInsert;
