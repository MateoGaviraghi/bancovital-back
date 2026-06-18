import {
  bigint,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';
import { laboratorio } from './laboratorio';

/**
 * Formatos de impresión PDF por laboratorio.
 * Un laboratorio puede tener N formatos; cada uno se asocia a un tipo de
 * documento (tipo = 'informe' | 'orden'). Al renderizar se usa el formato
 * más reciente para el tipo solicitado.
 *
 * layoutConfig JSONB — posiciones de campos sobre la imagen de fondo:
 * {
 *   "usarFondo": true,
 *   "campos": {
 *     "paciente.nombre": { "x": 120, "y": 240, "fontSize": 12, "color": "#000" },
 *     "orden.protocolo": { "x": 300, "y": 240, "fontSize": 10 }
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
    /** Nombre descriptivo del formato (ej: "Membrete institucional"). */
    nombre: text('nombre').notNull().default('Formato predeterminado'),
    /**
     * Tipo de documento al que aplica este formato.
     * Valores: 'informe' | 'orden'
     */
    tipo: text('tipo').notNull().default('informe'),
    fondoPath: text('fondo_path'),
    layoutConfig: jsonb('layout_config'),
    marginTop: integer('margin_top').notNull().default(20),
    marginBottom: integer('margin_bottom').notNull().default(20),
    marginLeft: integer('margin_left').notNull().default(20),
    marginRight: integer('margin_right').notNull().default(20),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => ({
    labIdx: index('idx_preferencia_pdf_lab').on(t.labId),
    labTipoIdx: index('idx_preferencia_pdf_lab_tipo').on(t.labId, t.tipo),
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
