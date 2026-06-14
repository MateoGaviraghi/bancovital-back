import { sql } from 'drizzle-orm';
import { bigint, check, index, numeric, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { movimientoTipoEnum } from './enums';
import { laboratorio } from './laboratorio';

/**
 * Libro de cuenta manual de Nodo por laboratorio (estado de cuenta).
 * - tipo 'cargo': lo que el lab adeuda a Nodo (facturación, excedentes, etc.)
 * - tipo 'pago': lo que el lab pagó.
 * balance = sum(pagos) − sum(cargos), calculado con Decimal.
 * Soft-delete via deletedAt para correcciones (no se borran filas físicamente).
 */
export const labMovimiento = pgTable(
  'lab_movimiento',
  {
    id: bigint('id', { mode: 'number' })
      .primaryKey()
      .generatedByDefaultAsIdentity({ name: 'lab_movimiento_id_seq' }),
    labId: bigint('lab_id', { mode: 'number' })
      .notNull()
      .references(() => laboratorio.id, { onDelete: 'restrict' }),
    tipo: movimientoTipoEnum('tipo').notNull(),
    monto: numeric('monto', { precision: 12, scale: 2 }).notNull(),
    concepto: text('concepto').notNull(),
    notas: text('notas'),
    fecha: timestamp('fecha', { withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid('created_by'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => ({
    labFechaIdx: index('idx_lab_movimiento_lab_fecha').on(t.labId, t.fecha),
    montoPositivo: check('lab_movimiento_monto_positivo', sql`${t.monto} > 0`),
  }),
);

export type LabMovimiento = typeof labMovimiento.$inferSelect;
export type NewLabMovimiento = typeof labMovimiento.$inferInsert;
