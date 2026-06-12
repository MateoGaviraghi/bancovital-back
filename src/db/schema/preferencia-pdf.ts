import { bigint, integer, jsonb, pgTable, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { laboratorio } from './laboratorio';

/**
 * Configuracion de PDF por laboratorio.
 * Un registro por laboratorio (relacion 1:1).
 *
 * layoutConfig: JSONB con posiciones de campos sobre la imagen de fondo.
 * Ejemplo:
 * {
 *   "usarFondo": true,
 *   "campos": {
 *     "paciente.nombre":   { "x": 120, "y": 240, "fontSize": 12, "color": "#000" },
 *     "orden.protocolo":   { "x": 300, "y": 240, "fontSize": 10 },
 *     "resultado.glucosa": { "x": 300, "y": 420, "fontSize": 10 }
 *   }
 * }
 */
export const preferenciaPdf = pgTable(
  'preferencia_pdf',
  {
    id: bigint('id', { mode: 'number' })
      .primaryKey()
      .generatedByDefaultAsIdentity({ name: 'preferencia_pdf_id_seq' }),
    labId: bigint('lab_id', { mode: 'number' })
      .notNull()
      .references(() => laboratorio.id, { onDelete: 'cascade' }),
    fondoPath: text('fondo_path'),
    layoutConfig: jsonb('layout_config'),
    marginTop: integer('margin_top').notNull().default(20),
    marginBottom: integer('margin_bottom').notNull().default(20),
    marginLeft: integer('margin_left').notNull().default(20),
    marginRight: integer('margin_right').notNull().default(20),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    labUnique: uniqueIndex('idx_preferencia_pdf_lab').on(t.labId),
  }),
);

export type PreferenciaPdf = typeof preferenciaPdf.$inferSelect;
export type NewPreferenciaPdf = typeof preferenciaPdf.$inferInsert;

export interface PdfLayoutCampo {
  x: number;
  y: number;
  fontSize?: number;
  color?: string;
}

export interface PdfLayoutConfig {
  usarFondo?: boolean;
  campos?: Record<string, PdfLayoutCampo>;
}
