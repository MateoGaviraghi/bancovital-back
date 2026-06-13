/**
 * Template PDF de contrato de prestación de servicios.
 *
 * Estética formal: serif para títulos, sans-serif para cuerpo (9.5pt),
 * tinta #1a1a1a, violeta #8b2fef solo en numeración de cláusulas y líneas divisorias.
 * A4, márgenes de 24mm.
 *
 * TODO: Reemplazar Helvetica/Times-Roman por Source Serif 4 + Public Sans cuando
 * se puedan descargar los TTF (falló la descarga automatizada desde google/fonts).
 * Ver src/pdf/fonts/ — PublicSans-Regular.ttf y PublicSans-SemiBold.ttf sí están disponibles.
 */

import { Document, Font, Image, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import React from 'react';

// ── Tipografía ─────────────────────────────────────────────────────────────────
// Public Sans está descargado; Source Serif 4 usa fallback Times-Roman.
// Para registro solo se hace una vez en el módulo de render.

const ACCENT = '#8b2fef';
const INK = '#1a1a1a';
const GREY = '#555555';
const LIGHT_GREY = '#888888';
const BORDER_GREY = '#d0d0d0';
const BG_LIGHT = '#f8f8f8';

const MM = 2.835; // 1mm ≈ 2.835pt

const styles = StyleSheet.create({
  page: {
    fontFamily: 'PublicSans',
    fontSize: 9.5,
    color: INK,
    paddingTop: 24 * MM,
    paddingBottom: 24 * MM,
    paddingLeft: 24 * MM,
    paddingRight: 24 * MM,
    lineHeight: 1.5,
  },

  // ── Header portada
  coverHeader: {
    borderBottomWidth: 2,
    borderBottomColor: ACCENT,
    paddingBottom: 8,
    marginBottom: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  brandName: {
    fontFamily: 'SourceSerif4',
    fontSize: 22,
    color: INK,
    letterSpacing: 1.5,
  },
  coverMeta: {
    fontSize: 8,
    color: LIGHT_GREY,
    textAlign: 'right',
  },

  // ── Bloque portada
  coverTitle: {
    fontFamily: 'SourceSerif4',
    fontSize: 16,
    color: INK,
    marginBottom: 4,
  },
  coverSubtitle: {
    fontSize: 9,
    color: GREY,
    marginBottom: 24,
  },

  // ── Tabla de datos portada
  infoRow: {
    flexDirection: 'row',
    marginBottom: 3,
  },
  infoLabel: {
    width: 110,
    color: GREY,
  },
  infoValue: {
    flex: 1,
    color: INK,
  },

  // ── Sección / Cláusula
  sectionBlock: {
    marginBottom: 14,
  },
  clauseHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  clauseNumber: {
    color: ACCENT,
    fontFamily: 'PublicSansSemiBold',
    fontSize: 9.5,
    width: 28,
  },
  clauseTitle: {
    fontFamily: 'SourceSerif4Bold',
    fontSize: 10,
    color: INK,
    flex: 1,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  clauseBody: {
    paddingLeft: 28,
    color: INK,
    fontSize: 9.5,
    lineHeight: 1.55,
  },

  // ── Divisor
  divider: {
    borderBottomWidth: 0.5,
    borderBottomColor: ACCENT,
    marginBottom: 12,
    marginTop: 2,
    opacity: 0.4,
  },
  dividerGrey: {
    borderBottomWidth: 0.5,
    borderBottomColor: BORDER_GREY,
    marginBottom: 10,
    marginTop: 8,
  },

  // ── Tabla de planes
  table: {
    marginBottom: 8,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderBottomColor: BORDER_GREY,
    paddingVertical: 4,
  },
  tableHeaderRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: INK,
    paddingVertical: 4,
    backgroundColor: BG_LIGHT,
  },
  tableCell: {
    flex: 1,
    fontSize: 8.5,
    fontFamily: 'PublicSans',
    fontVariant: ['tabular-nums'] as never,
  },
  tableCellBold: {
    flex: 1,
    fontSize: 8.5,
    fontFamily: 'PublicSansSemiBold',
  },
  tableCellHighlight: {
    flex: 1,
    fontSize: 8.5,
    fontFamily: 'PublicSansSemiBold',
    color: ACCENT,
  },

  // ── Bloque de firma
  signBlock: {
    backgroundColor: BG_LIGHT,
    borderWidth: 0.5,
    borderColor: BORDER_GREY,
    padding: 16,
    marginTop: 16,
  },
  signTitle: {
    fontFamily: 'SourceSerif4Bold',
    fontSize: 11,
    marginBottom: 10,
    color: INK,
  },
  signRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  signLabel: {
    width: 130,
    color: GREY,
  },
  signValue: {
    flex: 1,
    color: INK,
    fontFamily: 'PublicSansSemiBold',
  },

  // ── Footer
  footer: {
    position: 'absolute',
    bottom: 14 * MM,
    left: 24 * MM,
    right: 24 * MM,
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontSize: 7.5,
    color: LIGHT_GREY,
    borderTopWidth: 0.5,
    borderTopColor: BORDER_GREY,
    paddingTop: 6,
  },

  // ── Página de constancia de firma
  evidenceHeader: {
    fontFamily: 'SourceSerif4Bold',
    fontSize: 13,
    color: INK,
    marginBottom: 16,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  evidenceSignatureBox: {
    borderWidth: 0.5,
    borderColor: BORDER_GREY,
    padding: 12,
    marginBottom: 14,
    alignItems: 'center',
  },
  evidenceSignatureLabel: {
    fontSize: 8,
    color: LIGHT_GREY,
    marginBottom: 6,
  },
  evidenceRow: {
    flexDirection: 'row',
    marginBottom: 5,
  },
  evidenceLabel: {
    width: 160,
    color: GREY,
    fontSize: 9,
  },
  evidenceValue: {
    flex: 1,
    color: INK,
    fontSize: 9,
    fontFamily: 'PublicSansSemiBold',
  },
  hashBox: {
    backgroundColor: BG_LIGHT,
    borderWidth: 0.5,
    borderColor: BORDER_GREY,
    padding: 8,
    marginTop: 8,
  },
  hashLabel: {
    fontSize: 7.5,
    color: GREY,
    marginBottom: 3,
  },
  hashValue: {
    fontSize: 7.5,
    fontFamily: 'PublicSans',
    color: INK,
    wordBreak: 'break-all' as never,
  },

  // ── Nota sobre URL de firma
  urlNote: {
    backgroundColor: BG_LIGHT,
    borderLeftWidth: 2,
    borderLeftColor: ACCENT,
    padding: 10,
    marginTop: 16,
    marginBottom: 16,
  },
  urlNoteText: {
    fontSize: 9,
    color: GREY,
  },
  urlNoteUrl: {
    fontSize: 9,
    color: ACCENT,
    fontFamily: 'PublicSansSemiBold',
  },
});

// ── Tipos ──────────────────────────────────────────────────────────────────────

export interface PlanRow {
  id: number;
  nombre: string;
  cupoOrdenesMes: number;
  precioMensual: string;
  precioOrdenExcedente: string;
}

export interface ContratoData {
  id: number;
  razonSocial: string;
  nombreContacto: string;
  cuit?: string | null;
  emailFirmante: string;
  telefono?: string | null;
  propuesta: { descripcion: string; notas?: string };
  planSugeridoId?: number | null;
  createdAt: Date;
  expiraAt: Date;
  token: string;
  planes: PlanRow[];
  appUrl: string;
}

export interface ContratoFirmadoData extends ContratoData {
  planElegidoId: number;
  firmaDataUrl: string;
  evidencia: {
    ip: string;
    userAgent: string;
    timestamp: string;
    otpEmail: string;
    pdfHashSha256: string;
  };
  planElegidoNombre: string;
  firmadoAt: Date;
}

// ── Helpers de formato ─────────────────────────────────────────────────────────

const TZ_AR = 'America/Argentina/Buenos_Aires';

function fmtDate(d: Date): string {
  return d.toLocaleDateString('es-AR', { timeZone: TZ_AR, dateStyle: 'long' });
}

function fmtDateTime(d: Date): string {
  return d.toLocaleString('es-AR', { timeZone: TZ_AR, dateStyle: 'long', timeStyle: 'short' });
}

function fmtMoney(s: string): string {
  const n = Number.parseFloat(s);
  if (Number.isNaN(n)) return s;
  return n.toLocaleString('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 2,
  });
}

function padId(id: number): string {
  return `CON-${String(id).padStart(6, '0')}`;
}

// ── Componentes internos ───────────────────────────────────────────────────────

/**
 * Renderiza una lista de párrafos como Text separados con margen inferior.
 * Evita usar \n\n dentro de un solo Text, que causa crash en @react-pdf/textkit
 * cuando hay caracteres de control sin glyph en el fallback font.
 */
const Paragraphs = ({ items }: { items: string[] }) => (
  <View>
    {items.map((text, i) => (
      <Text key={text} style={{ marginBottom: i < items.length - 1 ? 5 : 0 }}>
        {text}
      </Text>
    ))}
  </View>
);

const Footer = () => (
  <View style={styles.footer} fixed>
    <Text>NODO · nodotech.dev</Text>
    <Text>Mateo Gaviraghi +54 9 3425 16-2081 · Justo González Viescas +54 9 3425 26-7005</Text>
  </View>
);

const Divider = ({ accent = false }: { accent?: boolean }) => (
  <View style={accent ? styles.divider : styles.dividerGrey} />
);

const Clause = ({
  num,
  title,
  children,
}: { num: string; title: string; children: React.ReactNode }) => (
  <View style={styles.sectionBlock}>
    <View style={styles.clauseHeader}>
      <Text style={styles.clauseNumber}>{num}.</Text>
      <Text style={styles.clauseTitle}>{title}</Text>
    </View>
    <View style={styles.clauseBody}>{children}</View>
  </View>
);

const InfoRow = ({ label, value }: { label: string; value: string }) => (
  <View style={styles.infoRow}>
    <Text style={styles.infoLabel}>{label}</Text>
    <Text style={styles.infoValue}>{value}</Text>
  </View>
);

// ── Template principal ─────────────────────────────────────────────────────────

export const ContratoTemplate = ({ data }: { data: ContratoData }) => {
  const contractUrl = `${data.appUrl}/contratar/${data.token}`;

  return (
    <Document
      title={`${padId(data.id)} — Contrato de Prestación de Servicios`}
      author="NODO"
      subject="Contrato de Prestación de Servicios"
    >
      {/* ── Página 1: Portada ────────────────────────────────────────────────── */}
      <Page size="A4" style={styles.page}>
        <Footer />

        {/* Encabezado */}
        <View style={styles.coverHeader}>
          <Text style={styles.brandName}>NODO</Text>
          <View>
            <Text style={styles.coverMeta}>{padId(data.id)}</Text>
            <Text style={styles.coverMeta}>{fmtDate(data.createdAt)}</Text>
          </View>
        </View>

        {/* Título */}
        <Text style={styles.coverTitle}>Contrato de Prestación de Servicios</Text>
        <Text style={styles.coverSubtitle}>Documento para firma electrónica</Text>

        <View style={styles.urlNote}>
          <Text style={styles.urlNoteText}>URL de firma: </Text>
          <Text style={styles.urlNoteUrl}>{contractUrl}</Text>
        </View>

        <Divider />

        {/* Datos del cliente */}
        <InfoRow label="Razón social" value={data.razonSocial} />
        <InfoRow label="Contacto" value={data.nombreContacto} />
        {data.cuit ? <InfoRow label="CUIT" value={data.cuit} /> : null}
        <InfoRow label="Correo electrónico" value={data.emailFirmante} />
        {data.telefono ? <InfoRow label="Teléfono" value={data.telefono} /> : null}
        <InfoRow label="Válido hasta" value={fmtDate(data.expiraAt)} />

        <Divider />

        {/* Objeto */}
        <Clause num="1" title="Objeto">
          <Text>{data.propuesta.descripcion}</Text>
          {data.propuesta.notas ? (
            <Text style={{ marginTop: 6, color: GREY }}>Notas: {data.propuesta.notas}</Text>
          ) : null}
        </Clause>

        <Divider accent />

        {/* Planes y precios */}
        <Clause num="2" title="Planes y precios">
          <Text style={{ marginBottom: 8 }}>
            A continuación se detallan los planes disponibles al momento de la emisión del presente
            contrato. El plan marcado con (*) es el sugerido por Nodo en función del perfil del
            laboratorio.
          </Text>

          {/* Tabla */}
          <View style={styles.table}>
            <View style={styles.tableHeaderRow}>
              <Text style={[styles.tableCellBold, { flex: 2 }]}>Plan</Text>
              <Text style={styles.tableCellBold}>Cupo/mes</Text>
              <Text style={styles.tableCellBold}>Precio mensual</Text>
              <Text style={styles.tableCellBold}>Orden adicional</Text>
            </View>
            {data.planes.map((p) => {
              const isSugerido = data.planSugeridoId === p.id;
              return (
                <View key={p.id} style={styles.tableRow}>
                  <Text
                    style={
                      isSugerido
                        ? [styles.tableCellHighlight, { flex: 2 }]
                        : [styles.tableCell, { flex: 2 }]
                    }
                  >
                    {p.nombre}
                    {isSugerido ? ' (*)' : ''}
                  </Text>
                  <Text style={isSugerido ? styles.tableCellHighlight : styles.tableCell}>
                    {p.cupoOrdenesMes}
                  </Text>
                  <Text style={isSugerido ? styles.tableCellHighlight : styles.tableCell}>
                    {fmtMoney(p.precioMensual)}
                  </Text>
                  <Text style={isSugerido ? styles.tableCellHighlight : styles.tableCell}>
                    {fmtMoney(p.precioOrdenExcedente)}
                  </Text>
                </View>
              );
            })}
          </View>

          <View style={{ marginTop: 6 }}>
            <Text style={{ color: GREY, fontSize: 8.5, marginBottom: 3 }}>
              Regla de excedentes: las órdenes procesadas dentro del cupo mensual se facturan al
              precio del plan. Las que superen el cupo se facturan individualmente al precio de
              orden adicional indicado en la tabla, sin bloqueo del servicio.
            </Text>
            <Text style={{ color: GREY, fontSize: 8.5 }}>
              Rollover de cupo no utilizado: el cupo no consumido en un mes calendario se transfiere
              al mes siguiente con vigencia de un (1) mes; transcurrido ese plazo, vence sin
              compensación económica.
            </Text>
          </View>
        </Clause>
      </Page>

      {/* ── Página 2: Cláusulas ─────────────────────────────────────────────── */}
      <Page size="A4" style={styles.page}>
        <Footer />

        <Divider accent />

        <Clause num="3" title="Protección de datos personales">
          <Paragraphs
            items={[
              'En cumplimiento de la Ley N.° 25.326 de Protección de los Datos Personales de la República Argentina, las partes acuerdan lo siguiente:',
              'a) El laboratorio contratante es el responsable del tratamiento de los datos personales de sus pacientes, incluyendo datos de salud, que revisten la calidad de datos sensibles conforme al artículo 2 de la ley citada.',
              'b) Nodo actúa como encargado del tratamiento en los términos del artículo 25 de la mencionada ley, procesando los datos exclusivamente con la finalidad de prestar los servicios descritos en el presente contrato y conforme a las instrucciones del responsable.',
              'c) Ambas partes quedan sujetas al deber de confidencialidad y secreto profesional respecto de los datos personales a los que accedan en virtud de la prestación, con carácter indefinido aun después de concluida la relación contractual.',
              'd) Nodo utiliza los siguientes subencargados de infraestructura para la prestación del servicio: Supabase Inc. (almacenamiento de base de datos y autenticación) y Railway Technologies Inc. (infraestructura de cómputo). Dichos proveedores operan bajo sus propias políticas de privacidad y seguridad, con centros de datos situados en los Estados Unidos de América.',
              'e) El laboratorio es responsable de garantizar a sus pacientes los derechos de acceso, rectificación, supresión y confidencialidad sobre sus datos de salud conforme a la legislación aplicable.',
            ]}
          />
        </Clause>

        <Divider accent />

        <Clause num="4" title="Disponibilidad y soporte">
          <Paragraphs
            items={[
              'Nodo realizará esfuerzos razonables para mantener el servicio disponible de forma continua. Sin perjuicio de ello, podrán producirse interrupciones programadas para mantenimiento, actualizaciones o causas de fuerza mayor, de las cuales se procurará notificar con anticipación razonable.',
              'Nodo realizará copias de seguridad periódicas de la base de datos con una retención mínima de siete (7) días. Ante una pérdida de datos imputable a Nodo, se realizará la restauración a partir de la última copia disponible.',
            ]}
          />
        </Clause>

        <Divider accent />

        <Clause num="5" title="Facturación y mora">
          <Text>
            La facturación se efectúa mensualmente según el plan contratado y los excedentes
            generados en el período. Ante la falta de pago de dos (2) períodos consecutivos, Nodo
            podrá suspender el acceso al servicio. Los datos del laboratorio no serán eliminados
            durante el período de suspensión, siendo restablecido el acceso una vez regularizada la
            deuda.
          </Text>
        </Clause>

        <Divider accent />

        <Clause num="6" title="Vigencia y rescisión">
          <Text>
            El presente contrato tiene vigencia mensual y se renueva automáticamente. Cualquiera de
            las partes podrá rescindirlo notificando a la otra parte con un mínimo de treinta (30)
            días corridos de anticipación. Al momento de la baja, el laboratorio tendrá derecho a
            exportar la totalidad de sus datos en formato estándar (JSON/CSV) dentro de los treinta
            (30) días siguientes a la finalización del servicio.
          </Text>
        </Clause>

        <Divider accent />

        <Clause num="7" title="Limitación de responsabilidad">
          <Text>
            El sistema Nodo es una herramienta de gestión que asiste al laboratorio en el registro y
            seguimiento de sus órdenes y resultados. La responsabilidad profesional derivada de los
            actos de práctica bioquímica, la interpretación de resultados y la atención a pacientes
            recae exclusiva e íntegramente sobre el laboratorio y los profesionales matriculados a
            cargo del mismo. Nodo no asume responsabilidad alguna por daños directos o indirectos
            derivados del uso o imposibilidad de uso del sistema, salvo dolo o culpa grave imputable
            a Nodo.
          </Text>
        </Clause>

        <Divider accent />

        <Clause num="8" title="Jurisdicción">
          <Text>
            Para cualquier controversia que se suscite entre las partes con relación al presente
            contrato, se someten expresamente a la jurisdicción de los tribunales ordinarios de la
            ciudad de Santa Fe, provincia de Santa Fe, República Argentina, renunciando a cualquier
            otro fuero que pudiera corresponder.
          </Text>
        </Clause>

        <Divider />

        {/* Bloque de aceptación */}
        <View style={styles.signBlock}>
          <Text style={styles.signTitle}>Datos del firmante</Text>
          <View style={styles.signRow}>
            <Text style={styles.signLabel}>Nombre / Razón social</Text>
            <Text style={styles.signValue}>{data.razonSocial}</Text>
          </View>
          <View style={styles.signRow}>
            <Text style={styles.signLabel}>Representante</Text>
            <Text style={styles.signValue}>{data.nombreContacto}</Text>
          </View>
          {data.cuit ? (
            <View style={styles.signRow}>
              <Text style={styles.signLabel}>CUIT</Text>
              <Text style={styles.signValue}>{data.cuit}</Text>
            </View>
          ) : null}
          <View style={styles.signRow}>
            <Text style={styles.signLabel}>Correo electrónico</Text>
            <Text style={styles.signValue}>{data.emailFirmante}</Text>
          </View>
          <View style={[styles.signRow, { marginTop: 10 }]}>
            <Text style={{ fontSize: 8.5, color: GREY, lineHeight: 1.5 }}>
              La aceptación del presente contrato se realiza de forma electrónica mediante la
              plataforma de firma en línea de Nodo, identificando al firmante a través de un código
              de verificación de un solo uso (OTP) enviado al correo electrónico indicado. La firma
              electrónica tiene plena validez conforme a la legislación argentina aplicable.
            </Text>
          </View>
        </View>
      </Page>
    </Document>
  );
};

// ── Template firmado (agrega página de constancia) ─────────────────────────────

export const ContratoFirmadoTemplate = ({ data }: { data: ContratoFirmadoData }) => {
  const baseData: ContratoData = {
    id: data.id,
    razonSocial: data.razonSocial,
    nombreContacto: data.nombreContacto,
    cuit: data.cuit,
    emailFirmante: data.emailFirmante,
    telefono: data.telefono,
    propuesta: data.propuesta,
    planSugeridoId: data.planSugeridoId,
    createdAt: data.createdAt,
    expiraAt: data.expiraAt,
    token: data.token,
    planes: data.planes,
    appUrl: data.appUrl,
  };

  const base = ContratoTemplate({ data: baseData });
  const basePages = base.props.children as React.ReactElement[];

  return (
    <Document
      title={`${padId(data.id)} — Contrato de Prestación de Servicios (FIRMADO)`}
      author="NODO"
      subject="Contrato de Prestación de Servicios — Constancia de firma electrónica"
    >
      {basePages}

      {/* ── Página de constancia de firma electrónica ─────────────────────── */}
      <Page size="A4" style={styles.page}>
        <Footer />

        <View style={styles.coverHeader}>
          <Text style={styles.brandName}>NODO</Text>
          <Text style={styles.coverMeta}>{padId(data.id)}</Text>
        </View>

        <Text style={styles.evidenceHeader}>Constancia de firma electrónica</Text>

        {/* Imagen de la firma */}
        <View style={styles.evidenceSignatureBox}>
          <Text style={styles.evidenceSignatureLabel}>Firma del declarante</Text>
          <Image
            src={data.firmaDataUrl}
            style={{ width: 220, height: 100, objectFit: 'contain' }}
          />
        </View>

        {/* Datos de evidencia */}
        <View style={styles.evidenceRow}>
          <Text style={styles.evidenceLabel}>Firmante</Text>
          <Text style={styles.evidenceValue}>{data.nombreContacto}</Text>
        </View>
        <View style={styles.evidenceRow}>
          <Text style={styles.evidenceLabel}>Correo verificado (OTP)</Text>
          <Text style={styles.evidenceValue}>{data.evidencia.otpEmail}</Text>
        </View>
        <View style={styles.evidenceRow}>
          <Text style={styles.evidenceLabel}>Plan contratado</Text>
          <Text style={styles.evidenceValue}>{data.planElegidoNombre}</Text>
        </View>
        <View style={styles.evidenceRow}>
          <Text style={styles.evidenceLabel}>Fecha y hora (AR)</Text>
          <Text style={styles.evidenceValue}>{fmtDateTime(data.firmadoAt)}</Text>
        </View>
        <View style={styles.evidenceRow}>
          <Text style={styles.evidenceLabel}>Dirección IP</Text>
          <Text style={styles.evidenceValue}>{data.evidencia.ip}</Text>
        </View>
        <View style={styles.evidenceRow}>
          <Text style={styles.evidenceLabel}>Navegador / agente</Text>
          <Text style={styles.evidenceValue}>{data.evidencia.userAgent}</Text>
        </View>

        {/* Hash del documento original */}
        <View style={styles.hashBox}>
          <Text style={styles.hashLabel}>SHA-256 del documento original (PDF sin firma)</Text>
          <Text style={styles.hashValue}>{data.evidencia.pdfHashSha256}</Text>
        </View>

        <View style={[styles.signBlock, { marginTop: 20 }]}>
          <Text style={{ fontSize: 8.5, color: GREY, lineHeight: 1.5 }}>
            Este documento acredita la aceptación electrónica del Contrato de Prestación de
            Servicios {padId(data.id)} por parte del firmante identificado precedentemente. La
            identidad del firmante fue verificada mediante un código de un solo uso (OTP) enviado al
            correo electrónico indicado. El hash SHA-256 del documento original garantiza la
            integridad del contenido aceptado. Esta constancia forma parte integrante del contrato y
            tiene plena validez legal conforme a la legislación argentina aplicable.
          </Text>
        </View>
      </Page>
    </Document>
  );
};
