/**
 * Template PDF del contrato de prestación de servicios — Banco Vital.
 *
 * Identidad: navy #1f2b5b dominante (header band, numeración de cláusulas,
 * tabla, bloque de firma), rojo #cd0f0f como acento único por página (regla bajo
 * el header, fila de plan sugerido). Serif (Source Serif 4) para títulos,
 * sans (Public Sans) para cuerpo 9.5pt. A4, márgenes de 24mm.
 *
 * El sistema se presenta como "Banco Vital" (marca de producto); "Nodo" es la
 * empresa proveedora y figura en el crédito del header, el footer y el cuerpo
 * legal de las cláusulas (sin modificar).
 */

import { Document, Image, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import React from 'react';

// ── Paleta ───────────────────────────────────────────────────────────────────
const NAVY = '#1f2b5b';
const NAVY_SOFT = '#e9ecf5';
const RED = '#cd0f0f';
const INK = '#1a1a1a';
const GREY = '#4a4a4a';
const LIGHT_GREY = '#8a8a8a';
const BORDER = '#d6d9e3';
const WHITE = '#ffffff';
const WHITE_SOFT = '#b9c0d6';
const BG_HASH = '#f1f2f6';

const MM = 2.835; // 1mm ≈ 2.835pt
const PAGE_PAD = 24 * MM;

const styles = StyleSheet.create({
  page: {
    fontFamily: 'PublicSans',
    fontSize: 9.5,
    color: INK,
    paddingTop: PAGE_PAD,
    paddingBottom: 24 * MM,
    paddingLeft: PAGE_PAD,
    paddingRight: PAGE_PAD,
    lineHeight: 1.5,
  },

  // ── Header band (portada) — full-bleed navy
  band: {
    backgroundColor: NAVY,
    marginTop: -PAGE_PAD,
    marginLeft: -PAGE_PAD,
    marginRight: -PAGE_PAD,
    paddingTop: 24,
    paddingBottom: 18,
    paddingLeft: PAGE_PAD,
    paddingRight: PAGE_PAD,
    borderBottomWidth: 3,
    borderBottomColor: RED,
    marginBottom: 24,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  bandBrand: {
    fontFamily: 'SourceSerif4Bold',
    fontSize: 22,
    lineHeight: 1.1,
    color: WHITE,
    letterSpacing: 0.3,
  },
  bandCredit: {
    fontSize: 8,
    color: WHITE_SOFT,
    marginTop: 7,
    letterSpacing: 0.4,
  },
  bandMetaLabel: {
    fontSize: 7,
    color: WHITE_SOFT,
    textAlign: 'right',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  bandMetaValue: {
    fontSize: 10,
    color: WHITE,
    textAlign: 'right',
    fontFamily: 'PublicSansSemiBold',
    marginBottom: 6,
  },

  // ── Slim header (páginas siguientes)
  slimHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1.5,
    borderBottomColor: NAVY,
    paddingBottom: 6,
    marginBottom: 18,
  },
  slimBrand: {
    fontFamily: 'SourceSerif4Bold',
    fontSize: 12,
    color: NAVY,
  },
  slimMeta: {
    fontSize: 8,
    color: LIGHT_GREY,
    fontFamily: 'PublicSansSemiBold',
  },

  // ── Título del documento
  docTitle: {
    fontFamily: 'SourceSerif4Bold',
    fontSize: 17,
    color: NAVY,
    marginBottom: 3,
  },
  docSubtitle: {
    fontSize: 10.5,
    color: GREY,
    marginBottom: 18,
  },

  // ── Caja de datos del cliente (dos columnas)
  clientBox: {
    backgroundColor: NAVY_SOFT,
    paddingTop: 14,
    paddingBottom: 6,
    paddingLeft: 16,
    paddingRight: 16,
    marginBottom: 20,
    flexDirection: 'row',
  },
  clientCol: {
    flex: 1,
    paddingRight: 12,
  },
  dataLabel: {
    fontSize: 6.5,
    color: GREY,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
    marginBottom: 1,
  },
  dataValue: {
    fontSize: 9.5,
    color: INK,
    fontFamily: 'PublicSansSemiBold',
    marginBottom: 9,
  },

  // ── Cláusulas
  sectionBlock: {
    marginBottom: 14,
  },
  clauseHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 5,
  },
  clauseNumber: {
    color: NAVY,
    fontFamily: 'PublicSansSemiBold',
    fontSize: 11,
    width: 22,
  },
  clauseTitle: {
    fontFamily: 'SourceSerif4Bold',
    fontSize: 10.5,
    color: NAVY,
    flex: 1,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  clauseBody: {
    paddingLeft: 22,
    color: INK,
    fontSize: 9.5,
    lineHeight: 1.6,
  },

  // ── Divisor
  divider: {
    borderBottomWidth: 0.7,
    borderBottomColor: NAVY,
    opacity: 0.15,
    marginTop: 4,
    marginBottom: 12,
  },

  // ── Tabla de planes
  table: {
    marginTop: 4,
    marginBottom: 8,
  },
  tableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: NAVY,
    paddingVertical: 5,
    paddingHorizontal: 7,
  },
  tableHeaderCell: {
    fontSize: 8,
    fontFamily: 'PublicSansSemiBold',
    color: WHITE,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderBottomColor: BORDER,
    paddingVertical: 5,
    paddingHorizontal: 7,
  },
  tableRowSugerido: {
    flexDirection: 'row',
    backgroundColor: NAVY_SOFT,
    borderBottomWidth: 0.5,
    borderBottomColor: BORDER,
    borderLeftWidth: 2,
    borderLeftColor: RED,
    paddingVertical: 5,
    paddingHorizontal: 7,
    paddingLeft: 5,
  },
  tableCell: {
    fontSize: 8.5,
    fontFamily: 'PublicSans',
    color: INK,
    fontVariant: ['tabular-nums'] as never,
  },
  tableCellName: {
    fontFamily: 'PublicSansSemiBold',
  },
  tableNote: {
    color: GREY,
    fontSize: 8.5,
    marginBottom: 3,
    lineHeight: 1.5,
  },

  // ── Nota de URL de firma
  urlNote: {
    backgroundColor: NAVY_SOFT,
    borderLeftWidth: 2,
    borderLeftColor: NAVY,
    padding: 9,
    marginTop: 14,
  },
  urlNoteText: {
    fontSize: 8.5,
    color: GREY,
    marginBottom: 3,
  },
  urlNoteUrl: {
    fontSize: 8.5,
    color: NAVY,
    fontFamily: 'PublicSansSemiBold',
    wordBreak: 'break-all' as never,
  },

  // ── Bloque de firma
  signBlock: {
    backgroundColor: NAVY_SOFT,
    borderLeftWidth: 3,
    borderLeftColor: NAVY,
    padding: 14,
    marginTop: 16,
  },
  signTitle: {
    fontFamily: 'SourceSerif4Bold',
    fontSize: 11,
    marginBottom: 10,
    color: NAVY,
  },
  signRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  signLabel: {
    width: 130,
    color: GREY,
    fontSize: 9,
  },
  signValue: {
    flex: 1,
    color: INK,
    fontFamily: 'PublicSansSemiBold',
    fontSize: 9,
  },
  signNote: {
    fontSize: 8.5,
    color: GREY,
    lineHeight: 1.5,
  },

  // ── Footer
  footer: {
    position: 'absolute',
    bottom: 14 * MM,
    left: PAGE_PAD,
    right: PAGE_PAD,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 0.5,
    borderTopColor: BORDER,
    paddingTop: 6,
  },
  footerStrong: {
    fontSize: 7.5,
    color: GREY,
    fontFamily: 'PublicSansSemiBold',
  },
  footerText: {
    fontSize: 7.5,
    color: LIGHT_GREY,
  },

  // ── Página de constancia
  evidenceHeader: {
    fontFamily: 'SourceSerif4Bold',
    fontSize: 14,
    color: NAVY,
    marginBottom: 16,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  evidenceSignatureBox: {
    position: 'relative',
    borderWidth: 1,
    borderColor: NAVY,
    backgroundColor: NAVY_SOFT,
    paddingTop: 14,
    paddingBottom: 14,
    marginBottom: 16,
    alignItems: 'center',
  },
  evidenceSignatureLabel: {
    fontSize: 8,
    color: GREY,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  stamp: {
    position: 'absolute',
    top: 10,
    right: 10,
    borderWidth: 1,
    borderColor: RED,
    paddingVertical: 3,
    paddingHorizontal: 8,
  },
  stampText: {
    color: RED,
    fontSize: 9,
    fontFamily: 'PublicSansSemiBold',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
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
    backgroundColor: BG_HASH,
    borderLeftWidth: 2,
    borderLeftColor: NAVY,
    padding: 9,
    marginTop: 10,
  },
  hashLabel: {
    fontSize: 7.5,
    color: NAVY,
    fontFamily: 'PublicSansSemiBold',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 3,
  },
  hashValue: {
    fontSize: 7.5,
    fontFamily: 'PublicSans',
    color: INK,
    wordBreak: 'break-all' as never,
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

const Footer = ({ id }: { id: number }) => (
  <View style={styles.footer} fixed>
    <Text style={styles.footerStrong}>Banco Vital · por Nodo</Text>
    <Text style={styles.footerText}>{padId(id)}</Text>
    <Text
      style={styles.footerText}
      render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`}
    />
  </View>
);

const SlimHeader = ({ id }: { id: number }) => (
  <View style={styles.slimHeader}>
    <Text style={styles.slimBrand}>Banco Vital</Text>
    <Text style={styles.slimMeta}>Contrato de Prestación de Servicios · {padId(id)}</Text>
  </View>
);

const Divider = () => <View style={styles.divider} />;

const Clause = ({
  num,
  title,
  children,
}: { num: string; title: string; children: React.ReactNode }) => (
  <View style={styles.sectionBlock} wrap={false}>
    <View style={styles.clauseHeader}>
      <Text style={styles.clauseNumber}>{num}.</Text>
      <Text style={styles.clauseTitle}>{title}</Text>
    </View>
    <View style={styles.clauseBody}>{children}</View>
  </View>
);

const DataPair = ({ label, value }: { label: string; value: string }) => (
  <View>
    <Text style={styles.dataLabel}>{label}</Text>
    <Text style={styles.dataValue}>{value}</Text>
  </View>
);

// ── Template principal ─────────────────────────────────────────────────────────

export const ContratoTemplate = ({ data }: { data: ContratoData }) => {
  const contractUrl = `${data.appUrl}/contratar/${data.token}`;

  return (
    <Document
      title={`${padId(data.id)} — Contrato de Prestación de Servicios`}
      author="Nodo"
      subject="Contrato de Prestación de Servicios — Banco Vital"
    >
      {/* ── Página 1: Portada ────────────────────────────────────────────────── */}
      <Page size="A4" style={styles.page}>
        <Footer id={data.id} />

        {/* Letterhead band */}
        <View style={styles.band}>
          <View>
            <Text style={styles.bandBrand}>Banco Vital</Text>
            <Text style={styles.bandCredit}>por Nodo · nodotech.dev</Text>
          </View>
          <View>
            <Text style={styles.bandMetaLabel}>Contrato</Text>
            <Text style={styles.bandMetaValue}>{padId(data.id)}</Text>
            <Text style={styles.bandMetaLabel}>{fmtDate(data.createdAt)}</Text>
          </View>
        </View>

        {/* Título */}
        <Text style={styles.docTitle}>Contrato de Prestación de Servicios</Text>
        <Text style={styles.docSubtitle}>Propuesta para {data.razonSocial}</Text>

        {/* Datos del cliente — dos columnas */}
        <View style={styles.clientBox}>
          <View style={styles.clientCol}>
            <DataPair label="Razón social" value={data.razonSocial} />
            <DataPair label="Contacto" value={data.nombreContacto} />
            {data.cuit ? <DataPair label="CUIT" value={data.cuit} /> : null}
          </View>
          <View style={styles.clientCol}>
            <DataPair label="Correo electrónico" value={data.emailFirmante} />
            {data.telefono ? <DataPair label="Teléfono" value={data.telefono} /> : null}
            <DataPair label="Válido hasta" value={fmtDate(data.expiraAt)} />
          </View>
        </View>

        {/* Objeto */}
        <Clause num="1" title="Objeto">
          <Text>
            {data.propuesta.descripcion.trim() ||
              'Prestación del servicio de gestión integral para laboratorio bioquímico mediante el sistema Banco Vital, conforme a los planes y condiciones establecidos en el presente contrato.'}
          </Text>
          {data.propuesta.notas ? (
            <Text style={{ marginTop: 6, color: GREY }}>Notas: {data.propuesta.notas}</Text>
          ) : null}
        </Clause>

        <Divider />

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
              <Text style={[styles.tableHeaderCell, { flex: 2 }]}>Plan</Text>
              <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Cupo/mes</Text>
              <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Precio mensual</Text>
              <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Orden adicional</Text>
            </View>
            {data.planes.map((p) => {
              const isSugerido = data.planSugeridoId === p.id;
              return (
                <View key={p.id} style={isSugerido ? styles.tableRowSugerido : styles.tableRow}>
                  <Text style={[styles.tableCell, styles.tableCellName, { flex: 2 }]}>
                    {p.nombre}
                    {isSugerido ? ' (*)' : ''}
                  </Text>
                  <Text style={[styles.tableCell, { flex: 1 }]}>{p.cupoOrdenesMes}</Text>
                  <Text style={[styles.tableCell, { flex: 1 }]}>{fmtMoney(p.precioMensual)}</Text>
                  <Text style={[styles.tableCell, { flex: 1 }]}>
                    {fmtMoney(p.precioOrdenExcedente)}
                  </Text>
                </View>
              );
            })}
          </View>

          <View style={{ marginTop: 6 }}>
            <Text style={styles.tableNote}>
              Regla de excedentes: las órdenes procesadas dentro del cupo mensual se facturan al
              precio del plan. Las que superen el cupo se facturan individualmente al precio de
              orden adicional indicado en la tabla, sin bloqueo del servicio.
            </Text>
            <Text style={styles.tableNote}>
              Rollover de cupo no utilizado: el cupo no consumido en un mes calendario se transfiere
              al mes siguiente con vigencia de un (1) mes; transcurrido ese plazo, vence sin
              compensación económica.
            </Text>
          </View>

          {/* Nota de URL de firma */}
          <View style={styles.urlNote}>
            <Text style={styles.urlNoteText}>URL de firma:</Text>
            {(contractUrl.match(/.{1,64}/g) ?? [contractUrl]).map((chunk) => (
              <Text key={chunk} style={styles.urlNoteUrl}>
                {chunk}
              </Text>
            ))}
          </View>
        </Clause>
      </Page>

      {/* ── Página 2: Cláusulas ─────────────────────────────────────────────── */}
      <Page size="A4" style={styles.page}>
        <Footer id={data.id} />
        <SlimHeader id={data.id} />

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

        <Divider />

        <Clause num="4" title="Disponibilidad y soporte">
          <Paragraphs
            items={[
              'Nodo realizará esfuerzos razonables para mantener el servicio disponible de forma continua. Sin perjuicio de ello, podrán producirse interrupciones programadas para mantenimiento, actualizaciones o causas de fuerza mayor, de las cuales se procurará notificar con anticipación razonable.',
              'Nodo realizará copias de seguridad periódicas de la base de datos con una retención mínima de siete (7) días. Ante una pérdida de datos imputable a Nodo, se realizará la restauración a partir de la última copia disponible.',
            ]}
          />
        </Clause>

        <Divider />

        <Clause num="5" title="Facturación y mora">
          <Text>
            La facturación se efectúa mensualmente según el plan contratado y los excedentes
            generados en el período. Ante la falta de pago de dos (2) períodos consecutivos, Nodo
            podrá suspender el acceso al servicio. Los datos del laboratorio no serán eliminados
            durante el período de suspensión, siendo restablecido el acceso una vez regularizada la
            deuda.
          </Text>
        </Clause>

        <Divider />

        <Clause num="6" title="Vigencia y rescisión">
          <Text>
            El presente contrato tiene vigencia mensual y se renueva automáticamente. Cualquiera de
            las partes podrá rescindirlo notificando a la otra parte con un mínimo de treinta (30)
            días corridos de anticipación. Al momento de la baja, el laboratorio tendrá derecho a
            exportar la totalidad de sus datos en formato estándar (JSON/CSV) dentro de los treinta
            (30) días siguientes a la finalización del servicio.
          </Text>
        </Clause>

        <Divider />

        <Clause num="7" title="Limitación de responsabilidad">
          <Text>
            El sistema Banco Vital es una herramienta de gestión que asiste al laboratorio en el
            registro y seguimiento de sus órdenes y resultados. La responsabilidad profesional
            derivada de los actos de práctica bioquímica, la interpretación de resultados y la
            atención a pacientes recae exclusiva e íntegramente sobre el laboratorio y los
            profesionales matriculados a cargo del mismo. Nodo no asume responsabilidad alguna por
            daños directos o indirectos derivados del uso o imposibilidad de uso del sistema, salvo
            dolo o culpa grave imputable a Nodo.
          </Text>
        </Clause>

        <Divider />

        <Clause num="8" title="Jurisdicción">
          <Text>
            Para cualquier controversia que se suscite entre las partes con relación al presente
            contrato, se someten expresamente a la jurisdicción de los tribunales ordinarios de la
            ciudad de Santa Fe, provincia de Santa Fe, República Argentina, renunciando a cualquier
            otro fuero que pudiera corresponder.
          </Text>
        </Clause>

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
          <View style={{ marginTop: 10 }}>
            <Text style={styles.signNote}>
              La aceptación del presente contrato se realiza de forma electrónica mediante la
              plataforma de firma en línea de Banco Vital, identificando al firmante a través de un
              código de verificación de un solo uso (OTP) enviado al correo electrónico indicado. La
              firma electrónica tiene plena validez conforme a la legislación argentina aplicable.
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
      author="Nodo"
      subject="Contrato de Prestación de Servicios — Constancia de firma electrónica"
    >
      {basePages}

      {/* ── Página de constancia de firma electrónica ─────────────────────── */}
      <Page size="A4" style={styles.page}>
        <Footer id={data.id} />
        <SlimHeader id={data.id} />

        <Text style={styles.evidenceHeader}>Constancia de firma electrónica</Text>

        {/* Imagen de la firma */}
        <View style={styles.evidenceSignatureBox}>
          <View style={styles.stamp}>
            <Text style={styles.stampText}>Firmado</Text>
          </View>
          <Text style={styles.evidenceSignatureLabel}>Firma del declarante</Text>
          <Image src={data.firmaDataUrl} style={{ width: 220, height: 90, objectFit: 'contain' }} />
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
          <Text style={styles.signNote}>
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
