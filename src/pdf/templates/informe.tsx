import { Document, Image, Page, StyleSheet, Text, View } from '@react-pdf/renderer';

export type InformeFlag = 'normal' | 'low' | 'high' | 'critical_low' | 'critical_high' | null;

export interface InformeUnidadRow {
  nombre: string;
  simbolo: string | null;
  value: string;
}

export interface InformeResultRow {
  nbuCode: string;
  name: string;
  value: string;
  unit: string | null;
  range: string | null;
  flag: InformeFlag;
  methodology: string | null;
  referenceValue: string | null;
  notes: string | null;
  unidades?: InformeUnidadRow[];
}

export interface InformeData {
  lab: {
    legalName: string;
    cuit: string;
    address: string;
    cityProvince: string;
    phone: string | null;
    email: string | null;
    logoSrc: string | null;
  };
  protocol: {
    number: string;
    orderDate: string;
    issuedAt: string;
  };
  patient: {
    fullName: string;
    dni: string;
    sex: 'F' | 'M' | 'X' | null;
    age: string;
    birthDate: string;
  };
  insurer: {
    name: string;
    affiliateNumber: string | null;
  };
  doctor: {
    name: string | null;
    mp: string | null;
    diagnosis: string | null;
  };
  results: InformeResultRow[];
  signedBy: {
    name: string;
    matricula: string | null;
    signatureSrc: string | null;
  };
  fondoSrc?: string | null;
  layoutConfig?: Record<string, { x: number; y: number; fontSize?: number; color?: string }> | null;
  margins?: { top: number; bottom: number; left: number; right: number };
  /** Acento de marca derivado del primaryColor del lab (legible para texto blanco). */
  accent?: string | null;
  /** Tinte suave del acento (fondos de chips/badges). */
  accentSoft?: string | null;
  /** Sede principal del lab, impresa al pie del informe. */
  sede?: {
    nombre: string;
    direccion: string;
    localidad: string | null;
    telefono: string | null;
    horarios: string | null;
  } | null;
  /** QR (PNG data-URI) al portal público del informe (F7). */
  qrCodeDataUri?: string | null;
}

// Neutrales + semánticos FIJOS. El acento de marca llega por data.accent (color
// del lab); el fallback es navy Banco Vital. Los badges clínicos (normal/anormal/
// crítico) NO se tiñen: su color comunica significado médico.
const C = {
  primary: '#1f2b5b',
  primarySoft: '#e9ecf5',
  ink: '#1a1f33',
  muted: '#4a5570',
  subtle: '#8089a0',
  border: '#dde2ec',
  borderStrong: '#c3cad8',
  bandBg: '#f5f7fb',
  success: '#15803d',
  successSoft: '#dcfce7',
  warning: '#b45309',
  warningSoft: '#fef3c7',
  danger: '#b91c1c',
  dangerSoft: '#fee2e2',
};

const styles = StyleSheet.create({
  page: {
    paddingTop: 36,
    paddingBottom: 36,
    paddingHorizontal: 44,
    fontFamily: 'PublicSans',
    fontSize: 9.5,
    color: C.ink,
    lineHeight: 1.45,
  },

  // ── Header: logo + lab info + protocol chip (right, aligned to name)
  header: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 },
  logo: { width: 54, height: 54, marginRight: 14, objectFit: 'contain' },
  labInfo: { flexGrow: 1 },
  legalName: {
    fontFamily: 'SourceSerif4Bold',
    fontSize: 16,
    color: C.ink,
    lineHeight: 1.15,
    marginBottom: 4,
  },
  labLine: { fontSize: 8.5, color: C.muted, lineHeight: 1.35, marginBottom: 2 },

  // ── Rule (acento del lab)
  rule: { height: 2, backgroundColor: C.primary, marginBottom: 14 },

  // ── Protocol chip (in header, right, aligned to lab name)
  protocolBadge: {
    flexDirection: 'column',
    alignItems: 'flex-end',
    backgroundColor: C.primarySoft,
    borderRadius: 3,
    paddingVertical: 4,
    paddingHorizontal: 9,
    marginLeft: 12,
  },
  protocolLabel: {
    fontFamily: 'PublicSansSemiBold',
    fontSize: 6,
    color: C.primary,
    letterSpacing: 1.2,
  },
  protocolNumber: {
    fontFamily: 'SourceSerif4Bold',
    fontSize: 11.5,
    color: C.primary,
  },
  protocolDate: { fontSize: 7, color: C.muted, marginTop: 1 },

  // ── Info cards
  infoGrid: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  infoCard: {
    flex: 1,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 4,
    backgroundColor: C.bandBg,
    padding: 12,
  },
  cardTitle: {
    fontFamily: 'PublicSansSemiBold',
    fontSize: 7.5,
    color: C.primary,
    letterSpacing: 1.3,
    marginBottom: 7,
  },
  row: { flexDirection: 'row', marginVertical: 1.5 },
  rowLabel: { width: 96, color: C.muted, fontSize: 9 },
  rowValue: { flex: 1, fontSize: 9, color: C.ink, fontFamily: 'PublicSansSemiBold' },

  // ── Results table
  resultsTitle: {
    fontFamily: 'SourceSerif4Bold',
    fontSize: 12,
    color: C.primary,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 7,
  },
  table: { borderWidth: 1, borderColor: C.border, borderRadius: 4, overflow: 'hidden' },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: C.primary,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  th: {
    color: '#ffffff',
    fontFamily: 'PublicSansSemiBold',
    fontSize: 8,
    letterSpacing: 0.4,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderTopWidth: 0.5,
    borderTopColor: C.border,
    alignItems: 'flex-start',
  },

  // 5 columnas: RESULTADO ancho para que el texto se lea (no 1 palabra/linea)
  colName: { width: '27%', paddingRight: 8 },
  colValue: { width: '37%', paddingRight: 8 },
  colUnit: { width: '10%', paddingRight: 4 },
  colRange: { width: '16%', paddingRight: 4 },
  colFlag: { width: '10%' },

  practiceName: { fontFamily: 'PublicSansSemiBold', fontSize: 9.5, color: C.ink },
  nbuCode: { fontSize: 7.5, color: C.subtle, marginTop: 1 },
  metaText: { fontSize: 7.5, color: C.muted, marginTop: 2 },

  valueNum: { fontFamily: 'PublicSansSemiBold', fontSize: 10.5, color: C.ink, lineHeight: 1.3 },
  valueProse: { fontSize: 9, color: C.ink, lineHeight: 1.4 },
  unitText: { fontSize: 8.5, color: C.muted, lineHeight: 1.3 },
  rangeText: { fontSize: 8.5, color: C.muted, lineHeight: 1.3 },

  // Sub-filas de unidades (sub-componentes de práctica multi-analito)
  unidadesBlock: {
    marginTop: 6,
    paddingTop: 4,
    borderTopWidth: 0.5,
    borderTopColor: C.border,
    flexDirection: 'column',
  },
  unidadRow: {
    flexDirection: 'row',
    marginTop: 2,
    alignItems: 'baseline',
  },
  unidadNombre: {
    width: '52%',
    fontSize: 8.5,
    color: C.muted,
    paddingRight: 6,
  },
  unidadValue: {
    flex: 1,
    fontSize: 9,
    color: C.ink,
  },
  unidadSimbolo: {
    fontSize: 8,
    color: C.subtle,
    marginLeft: 4,
  },

  badge: {
    borderRadius: 4,
    paddingVertical: 2,
    paddingHorizontal: 6,
    fontFamily: 'PublicSansSemiBold',
    fontSize: 7.5,
    letterSpacing: 0.3,
  },
  badgeNormal: { backgroundColor: C.successSoft, color: C.success },
  badgeAbnormal: { backgroundColor: C.warningSoft, color: C.warning },
  badgeCritical: { backgroundColor: C.dangerSoft, color: C.danger },

  // Empuja el footer (firma) al fondo de la página: en informes cortos la firma
  // queda abajo en vez de flotar pegada a la tabla con media hoja en blanco.
  flexSpacer: { flexGrow: 1, minHeight: 28 },

  // ── Footer — flujo normal (no absoluto, no fixed) para que aparezca
  // siempre DESPUÉS de todo el contenido, solo en la última página.
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    borderTopWidth: 1.5,
    borderTopColor: C.primary,
    paddingTop: 10,
  },
  signBlock: { width: '58%', alignItems: 'center' },
  signatureImg: {
    width: 180,
    height: 64,
    objectFit: 'contain',
    marginBottom: 2,
  },
  // Espacio reservado para la firma manuscrita cuando el lab no cargó imagen.
  signSpace: { height: 42 },
  signLine: {
    width: 200,
    borderTopWidth: 0.75,
    borderTopColor: C.borderStrong,
    marginBottom: 5,
  },
  signRole: {
    fontFamily: 'PublicSansSemiBold',
    fontSize: 6.5,
    color: C.subtle,
    letterSpacing: 0.8,
    marginBottom: 5,
  },
  signed: { fontFamily: 'PublicSansSemiBold', fontSize: 11, color: C.ink },
  signedMat: { fontSize: 8.5, color: C.muted, marginTop: 1 },
  issuedAt: { fontSize: 7.5, color: C.subtle },

  // ── Bloque QR (portal del paciente) en el footer, alineado a la derecha
  footerRight: { alignItems: 'flex-end' },
  qrBlock: { alignItems: 'center', marginBottom: 3 },
  qrImg: { width: 60, height: 60 },
  qrCaption: { fontSize: 6, color: C.subtle, marginTop: 1, letterSpacing: 0.2 },

  // ── Línea de sede principal al pie
  sedeLine: { marginTop: 6, alignItems: 'center' },
  sedeText: { fontSize: 7.5, color: C.muted, textAlign: 'center', lineHeight: 1.3 },
});

const SEX_LABEL: Record<'F' | 'M' | 'X', string> = {
  F: 'Femenino',
  M: 'Masculino',
  X: 'Otro',
};

function flagLabel(flag: InformeFlag): string {
  switch (flag) {
    case 'normal':
      return 'NORMAL';
    case 'low':
      return 'BAJO';
    case 'high':
      return 'ALTO';
    case 'critical_low':
      return 'CRÍTICO BAJO';
    case 'critical_high':
      return 'CRÍTICO ALTO';
    default:
      return '';
  }
}

function badgeStyle(flag: InformeFlag) {
  if (flag === 'normal') return styles.badgeNormal;
  if (flag === 'critical_low' || flag === 'critical_high') return styles.badgeCritical;
  if (flag === 'low' || flag === 'high') return styles.badgeAbnormal;
  return null;
}

/** Numerico = entero/decimal (coma o punto), opcional signo / < > ≤ ≥. Lo
 * demas (texto cualitativo) se renderiza a todo el ancho. */
function isNumericValue(value: string): boolean {
  const v = value.trim();
  if (!v) return true;
  return /^[<>≤≥]?\s*-?\d+([.,]\d+)?$/.test(v);
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

export function InformeTemplate({ data }: { data: InformeData }) {
  const sexLabel = data.patient.sex ? SEX_LABEL[data.patient.sex] : '—';
  // Acento de marca derivado del lab (con fallback al navy Banco Vital).
  const accent = data.accent || C.primary;
  const accentSoft = data.accentSoft || C.primarySoft;
  const pageStyle = data.margins
    ? {
        ...styles.page,
        paddingTop: data.margins.top,
        paddingBottom: data.margins.bottom,
        paddingLeft: data.margins.left,
        paddingRight: data.margins.right,
      }
    : styles.page;

  return (
    <Document
      title={`Informe ${data.protocol.number}`}
      author={data.lab.legalName}
      subject="Informe de laboratorio"
    >
      <Page size="A4" style={pageStyle}>
        {data.fondoSrc ? (
          <Image
            src={data.fondoSrc}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
            }}
            fixed
          />
        ) : null}
        {/* Header: logo + lab info */}
        <View style={styles.header}>
          {data.lab.logoSrc ? <Image src={data.lab.logoSrc} style={styles.logo} /> : null}
          <View style={styles.labInfo}>
            <Text style={styles.legalName}>{data.lab.legalName}</Text>
            <Text style={styles.labLine}>
              {data.lab.address} — {data.lab.cityProvince}
            </Text>
            <Text style={styles.labLine}>
              CUIT {data.lab.cuit}
              {data.lab.phone ? `  ·  Tel. ${data.lab.phone}` : ''}
              {data.lab.email ? `  ·  ${data.lab.email}` : ''}
            </Text>
          </View>
          <View style={[styles.protocolBadge, { backgroundColor: accentSoft }]}>
            <Text style={[styles.protocolLabel, { color: accent }]}>PROTOCOLO</Text>
            <Text style={[styles.protocolNumber, { color: accent }]}>{data.protocol.number}</Text>
            <Text style={styles.protocolDate}>{data.protocol.orderDate}</Text>
          </View>
        </View>

        {/* Accent rule */}
        <View style={[styles.rule, { backgroundColor: accent }]} />

        {/* Patient + coverage cards */}
        <View style={styles.infoGrid}>
          <View style={styles.infoCard}>
            <Text style={[styles.cardTitle, { color: accent }]}>PACIENTE</Text>
            <InfoRow label="Apellido, Nombre" value={data.patient.fullName} />
            <InfoRow label="DNI" value={data.patient.dni} />
            <InfoRow label="Sexo · Edad" value={`${sexLabel} · ${data.patient.age}`} />
            <InfoRow label="Nacimiento" value={data.patient.birthDate} />
          </View>

          <View style={styles.infoCard}>
            <Text style={[styles.cardTitle, { color: accent }]}>COBERTURA Y MÉDICO</Text>
            <InfoRow
              label="Obra social"
              value={`${data.insurer.name}${
                data.insurer.affiliateNumber ? ` · ${data.insurer.affiliateNumber}` : ''
              }`}
            />
            <InfoRow
              label="Médico"
              value={`${data.doctor.name ?? '—'}${
                data.doctor.mp ? ` · M.P. ${data.doctor.mp}` : ''
              }`}
            />
            {data.doctor.diagnosis ? (
              <InfoRow label="Diagnóstico" value={data.doctor.diagnosis} />
            ) : null}
          </View>
        </View>

        {/* Results table */}
        <Text style={[styles.resultsTitle, { color: accent }]}>Resultados</Text>
        <View style={styles.table}>
          <View style={[styles.tableHeader, { backgroundColor: accent }]} fixed>
            <Text style={[styles.th, styles.colName]}>PRÁCTICA</Text>
            <Text style={[styles.th, styles.colValue]}>RESULTADO</Text>
            <Text style={[styles.th, styles.colUnit]}>UNIDAD</Text>
            <Text style={[styles.th, styles.colRange]}>REFERENCIA</Text>
            <Text style={[styles.th, styles.colFlag]}>ESTADO</Text>
          </View>
          {data.results.map((r) => {
            const bStyle = badgeStyle(r.flag);
            const numeric = isNumericValue(r.value);
            return (
              <View key={r.nbuCode} style={styles.tableRow} wrap={false}>
                <View style={styles.colName}>
                  <Text style={styles.practiceName}>{r.name}</Text>
                  <Text style={styles.nbuCode}>NBU {r.nbuCode}</Text>
                  {r.methodology ? (
                    <Text style={styles.metaText}>Método: {r.methodology}</Text>
                  ) : null}
                  {r.referenceValue ? (
                    <Text style={styles.metaText}>Ref.: {r.referenceValue}</Text>
                  ) : null}
                  {r.notes ? <Text style={styles.metaText}>{r.notes}</Text> : null}
                </View>
                <View style={styles.colValue}>
                  <Text style={numeric ? styles.valueNum : styles.valueProse}>
                    {r.value || '—'}
                  </Text>
                  {r.unidades && r.unidades.length > 0 ? (
                    <View style={styles.unidadesBlock}>
                      {r.unidades.map((u, i) => (
                        <View key={`${u.nombre}-${i}`} style={styles.unidadRow} wrap={false}>
                          <Text style={styles.unidadNombre}>{u.nombre}</Text>
                          <Text style={styles.unidadValue}>{u.value || '—'}</Text>
                          {u.simbolo ? <Text style={styles.unidadSimbolo}>{u.simbolo}</Text> : null}
                        </View>
                      ))}
                    </View>
                  ) : null}
                </View>
                <View style={styles.colUnit}>
                  <Text style={styles.unitText}>{r.unit ?? '—'}</Text>
                </View>
                <View style={styles.colRange}>
                  <Text style={styles.rangeText}>{r.range ?? '—'}</Text>
                </View>
                <View style={styles.colFlag}>
                  {bStyle ? (
                    <Text style={[styles.badge, bStyle]}>{flagLabel(r.flag)}</Text>
                  ) : (
                    <Text style={styles.rangeText}>—</Text>
                  )}
                </View>
              </View>
            );
          })}
        </View>

        {/* Empuja la firma/footer al fondo de la página */}
        <View style={styles.flexSpacer} />

        {/* Footer — solo en la última página, después de todos los resultados */}
        <View style={[styles.footer, { borderTopColor: accent }]}>
          <View style={styles.signBlock}>
            {data.signedBy.signatureSrc ? (
              <Image src={data.signedBy.signatureSrc} style={styles.signatureImg} />
            ) : (
              <View style={styles.signSpace} />
            )}
            <View style={styles.signLine} />
            <Text style={styles.signRole}>FIRMA Y SELLO</Text>
            <Text style={styles.signed}>{data.signedBy.name}</Text>
            {data.signedBy.matricula ? (
              <Text style={styles.signedMat}>{data.signedBy.matricula}</Text>
            ) : null}
          </View>
          <View style={styles.footerRight}>
            {data.qrCodeDataUri ? (
              <View style={styles.qrBlock}>
                <Image src={data.qrCodeDataUri} style={styles.qrImg} />
                <Text style={styles.qrCaption}>Verificá tu informe online</Text>
              </View>
            ) : null}
            <Text style={styles.issuedAt}>Emitido: {data.protocol.issuedAt}</Text>
          </View>
        </View>

        {/* Sede principal del lab (si está configurada) */}
        {data.sede ? (
          <View style={styles.sedeLine}>
            <Text style={styles.sedeText}>
              {data.sede.nombre} · {data.sede.direccion}
              {data.sede.localidad ? `, ${data.sede.localidad}` : ''}
              {data.sede.telefono ? `  ·  Tel. ${data.sede.telefono}` : ''}
              {data.sede.horarios ? `  ·  ${data.sede.horarios}` : ''}
            </Text>
          </View>
        ) : null}
      </Page>
    </Document>
  );
}
