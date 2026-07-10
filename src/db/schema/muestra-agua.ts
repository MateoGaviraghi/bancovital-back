import {
  bigint,
  boolean,
  index,
  numeric,
  pgTable,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';
import { laboratorio } from './laboratorio';
import { solicitanteAgua } from './solicitante-agua';

export const muestraAgua = pgTable(
  'muestra_agua',
  {
    id: bigint('id', { mode: 'number' })
      .primaryKey()
      .generatedByDefaultAsIdentity({ name: 'muestra_agua_id_seq' }),
    labId: bigint('lab_id', { mode: 'number' })
      .notNull()
      .references(() => laboratorio.id, { onDelete: 'cascade' }),
    solicitanteId: bigint('solicitante_id', { mode: 'number' })
      .notNull()
      .references(() => solicitanteAgua.id, { onDelete: 'restrict' }),
    fechaToma: timestamp('fecha_toma', { withTimezone: true }).notNull(),
    fechaRecepcion: timestamp('fecha_recepcion', { withTimezone: true }).notNull(),
    tipoMuestra: text('tipo_muestra').notNull(),
    lugarToma: text('lugar_toma'),
    descripcionPunto: text('descripcion_punto'),
    direccionPunto: text('direccion_punto'),
    localidadPunto: text('localidad_punto'),
    motivoAnalisis: text('motivo_analisis').notNull(),
    // Condiciones de la muestra
    recipienteAdecuado: boolean('recipiente_adecuado').notNull().default(false),
    recipienteEsteril: boolean('recipiente_esteril').notNull().default(false),
    conservacionTransporte: text('conservacion_transporte'),
    temperaturaRecepcion: numeric('temperatura_recepcion', { precision: 5, scale: 1 }),
    volumenRecibido: text('volumen_recibido'),
    muestraApta: boolean('muestra_apta').notNull().default(true),
    observacionesRecepcion: text('observaciones_recepcion'),
    // Análisis solicitados
    analisisFisicoquimico: boolean('analisis_fisicoquimico').notNull().default(false),
    analisisMicrobiologico: boolean('analisis_microbiologico').notNull().default(false),
    observaciones: text('observaciones'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    labIdx: index('idx_muestra_agua_lab').on(t.labId),
    solicitanteIdx: index('idx_muestra_agua_solicitante').on(t.solicitanteId),
  }),
);

export type MuestraAgua = typeof muestraAgua.$inferSelect;
export type NewMuestraAgua = typeof muestraAgua.$inferInsert;
