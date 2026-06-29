import { Document, Image, Page, StyleSheet, Text, View } from '@react-pdf/renderer';

const AR_NUM = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 6, useGrouping: true });
function fmtNum(s: string): string {
  const n = Number(s.replace(',', '.').trim());
  return Number.isNaN(n) ? s : AR_NUM.format(n);
}

export type InformeFlag = 'normal' | 'low' | 'high' | 'critical_low' | 'critical_high' | null;

export interface InformeUnidadRow {
  nombre: string;
  simbolo: string | null;
  value: string;
  rangeLow: string | null;
  rangeHigh: string | null;
  referenceText: string | null;
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
    streetAddress?: string | null;
    city?: string | null;
    phone?: string | null;
  };
  animalPatient?: {
    nombre: string;
    especie: string;
    raza: string | null;
    propietario: string;
    propietarioDni: string;
  } | null;
  insurer: {
    name: string;
    affiliateNumber: string | null;
  };
  doctor: {
    name: string | null;
    mp: string | null;
    diagnosis: string | null;
  };
  order?: {
    origin?: string | null;
    isUrgent?: boolean;
    notes?: string | null;
  };
  results: InformeResultRow[];
  signedBy: {
    name: string;
    matricula: string | null;
    signatureSrc: string | null;
  };
  fondoSrc?: string | null;
  layoutConfig?: Record<string, { x: number; y: number; fontSize?: number; color?: string; prefix?: string; bold?: boolean; headerBg?: string; headerColor?: string; borderColor?: string; rowColor?: string }> | null;
  margins?: { top: number; bottom: number; left: number; right: number };
  accent?: string | null;
  accentSoft?: string | null;
  sede?: {
    nombre: string;
    direccion: string;
    localidad: string | null;
    telefono: string | null;
    horarios: string | null;
  } | null;
  qrCodeDataUri?: string | null;
}

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

  header: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 },
  logo: { width: 76, height: 76, marginRight: 16, objectFit: 'contain' },
  labInfo: { flexGrow: 1 },
  legalName: {
    fontFamily: 'SourceSerif4Bold',
    fontSize: 16,
    color: C.ink,
    lineHeight: 1.15,
    marginBottom: 4,
  },
  labLine: { fontSize: 8.5, color: C.muted, lineHeight: 1.35, marginBottom: 2 },

  rule: { height: 2, backgroundColor: C.primary, marginBottom: 14 },

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

  colName: { width: '22%', paddingRight: 8 },
  colValue: { width: '28%', paddingRight: 8 },
  colUnit: { width: '8%', paddingRight: 4 },
  colRange: { width: '30%', paddingRight: 4 },
  colFlag: { width: '12%' },

  practiceName: { fontFamily: 'PublicSansSemiBold', fontSize: 9.5, color: C.ink },
  nbuCode: { fontSize: 7.5, color: C.subtle, marginTop: 1 },
  metaText: { fontSize: 7.5, color: C.muted, marginTop: 2 },

  valueNum: { fontFamily: 'PublicSansSemiBold', fontSize: 10.5, color: C.ink, lineHeight: 1.3 },
  valueProse: { fontSize: 8, color: C.ink, lineHeight: 1.35 },
  unitText: { fontSize: 8.5, color: C.muted, lineHeight: 1.3 },
  rangeText: { fontSize: 8.5, color: C.muted, lineHeight: 1.3 },

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

  flexSpacer: { flexGrow: 1, minHeight: 28 },

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

  footerRight: { alignItems: 'flex-end' },
  qrBlock: { alignItems: 'center', marginBottom: 3 },
  qrImg: { width: 60, height: 60 },
  qrCaption: { fontSize: 6, color: C.subtle, marginTop: 1, letterSpacing: 0.2 },

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

// ── Modo marca de agua: solo fondo + campos posicionados ─────────────

function resolveFieldValue(key: string, data: InformeData): string | null {
  switch (key) {
    case 'paciente.nombre':
      return data.patient.fullName;
    case 'paciente.dni':
      return data.patient.dni;
    case 'paciente.sexo':
      return data.patient.sex ? SEX_LABEL[data.patient.sex] : '—';
    case 'paciente.edad':
      return data.patient.age;
    case 'paciente.nacimiento':
      return data.patient.birthDate;
    case 'orden.protocolo':
      return data.protocol.number;
    case 'orden.fecha':
      return data.protocol.orderDate;
    case 'orden.emision':
      return data.protocol.issuedAt;
    case 'cobertura.obraSocial':
      return `${data.insurer.name}${data.insurer.affiliateNumber ? ` · ${data.insurer.affiliateNumber}` : ''}`;
    case 'cobertura.nroAfiliado':
      return data.insurer.affiliateNumber ?? '—';
    case 'medico.nombre':
      return data.doctor.name ?? '—';
    case 'medico.mp':
      return data.doctor.mp ? `M.P. ${data.doctor.mp}` : '—';
    case 'medico.diagnostico':
      return data.doctor.diagnosis ?? '—';
    case 'orden.diagnostico':
      return data.doctor.diagnosis ?? '—';
    case 'orden.origen':
      return data.order?.origin ?? '—';
    case 'orden.urgente':
      return data.order?.isUrgent ? 'Sí' : 'No';
    case 'orden.notas':
      return data.order?.notes ?? '—';
    case 'paciente.domicilio':
      return data.patient.streetAddress ?? '—';
    case 'paciente.ciudad':
      return data.patient.city ?? '—';
    case 'paciente.telefono':
      return data.patient.phone ?? '—';
    case 'firma.nombre':
      return data.signedBy.name;
    case 'firma.matricula':
      return data.signedBy.matricula ?? '—';
    case 'lab.nombre':
      return data.lab.legalName;
    case 'lab.cuit':
      return data.lab.cuit;
    case 'lab.direccion':
      return `${data.lab.address} — ${data.lab.cityProvince}`;
    case 'lab.telefono':
      return data.lab.phone ?? '—';
    case 'lab.email':
      return data.lab.email ?? '—';
    default:
      return null;
  }
}

interface TableColors {
  headerBg: string;
  headerColor: string;
  borderColor: string;
  rowColor: string;
}

const DEFAULT_TABLE_COLORS: TableColors = {
  headerBg: '#f5f0e8',
  headerColor: '#5a4a2f',
  borderColor: '#d4c9b0',
  rowColor: '#000000',
};

function OverlayResultsTable({ results, colors }: { results: InformeResultRow[]; colors: TableColors }) {
  return (
    <View style={{ borderWidth: 0.5, borderColor: colors.borderColor, borderRadius: 3, overflow: 'hidden' }}>
      <View style={{ flexDirection: 'row', backgroundColor: colors.headerBg, paddingVertical: 5, paddingHorizontal: 8 }}>
        <Text style={{ width: '30%', fontFamily: 'PublicSansSemiBold', fontSize: 7, color: colors.headerColor, letterSpacing: 0.3 }}>PRÁCTICA</Text>
        <Text style={{ width: '25%', fontFamily: 'PublicSansSemiBold', fontSize: 7, color: colors.headerColor, letterSpacing: 0.3 }}>RESULTADO</Text>
        <Text style={{ width: '12%', fontFamily: 'PublicSansSemiBold', fontSize: 7, color: colors.headerColor, letterSpacing: 0.3 }}>UNIDAD</Text>
        <Text style={{ width: '18%', fontFamily: 'PublicSansSemiBold', fontSize: 7, color: colors.headerColor, letterSpacing: 0.3 }}>REFERENCIA</Text>
        <Text style={{ width: '15%', fontFamily: 'PublicSansSemiBold', fontSize: 7, color: colors.headerColor, letterSpacing: 0.3 }}>ESTADO</Text>
      </View>
      {results.map((r) => {
        let flagColor = colors.rowColor;
        if (r.flag === 'normal') flagColor = C.success;
        else if (r.flag === 'low' || r.flag === 'high') flagColor = C.warning;
        else if (r.flag === 'critical_low' || r.flag === 'critical_high') flagColor = C.danger;
        return (
          <View key={r.nbuCode} style={{ flexDirection: 'row', paddingVertical: 5, paddingHorizontal: 8, borderTopWidth: 0.25, borderTopColor: colors.borderColor }} wrap={false}>
            <View style={{ width: '30%', paddingRight: 4 }}>
              <Text style={{ fontFamily: 'PublicSansSemiBold', fontSize: 8, color: colors.rowColor }}>{r.name}</Text>
              <Text style={{ fontSize: 6.5, color: colors.borderColor, marginTop: 1 }}>NBU {r.nbuCode}</Text>
              {r.methodology ? (
                <Text style={{ fontSize: 6.5, color: colors.rowColor, marginTop: 1 }}>Método: {r.methodology}</Text>
              ) : null}
              {r.referenceValue ? (
                <Text style={{ fontSize: 6.5, color: colors.rowColor, marginTop: 1 }}>Ref.: {r.referenceValue}</Text>
              ) : null}
            </View>
            <View style={{ width: '25%', paddingRight: 4 }}>
              <Text style={{ fontFamily: 'PublicSansSemiBold', fontSize: 9, color: colors.rowColor }}>{r.value || '—'}</Text>
            </View>
            <View style={{ width: '12%', paddingRight: 4 }}>
              <Text style={{ fontSize: 7.5, color: colors.rowColor }}>{r.unit ?? '—'}</Text>
            </View>
            <View style={{ width: '18%', paddingRight: 4 }}>
              <Text style={{ fontSize: 7.5, color: colors.rowColor }}>{r.range ?? '—'}</Text>
            </View>
            <View style={{ width: '15%' }}>
              <Text style={{ fontSize: 7, color: flagColor }}>{flagLabel(r.flag)}</Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

function WmRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', marginVertical: 1.5 }}>
      <Text style={{ fontFamily: 'PublicSansSemiBold', fontSize: 9, color: '#1a1a1a', width: 95 }}>
        {label}
      </Text>
      <Text style={{ fontSize: 9, color: '#1a1a1a' }}>{value}</Text>
    </View>
  );
}

function WatermarkInforme({ data }: { data: InformeData }) {
  const sexLabel = data.patient.sex ? SEX_LABEL[data.patient.sex] : '—';
  const tc = data.layoutConfig?.['tabla.resultados'];
  const tableColors: TableColors = {
    headerBg: tc?.headerBg ?? DEFAULT_TABLE_COLORS.headerBg,
    headerColor: tc?.headerColor ?? DEFAULT_TABLE_COLORS.headerColor,
    borderColor: tc?.borderColor ?? DEFAULT_TABLE_COLORS.borderColor,
    rowColor: tc?.rowColor ?? DEFAULT_TABLE_COLORS.rowColor,
  };
  const m = data.margins ?? { top: 20, bottom: 20, left: 40, right: 40 };

  return (
    <Document
      title={`Informe ${data.protocol.number}`}
      author={data.lab.legalName}
      subject="Informe de laboratorio"
    >
      <Page
        size="A4"
        style={{
          fontFamily: 'PublicSans',
          fontSize: 9,
          color: '#1a1a1a',
          paddingTop: m.top,
          paddingBottom: m.bottom,
          paddingLeft: m.left,
          paddingRight: m.right,
        }}
      >
        <Image
          src={data.fondoSrc!}
          style={{ position: 'absolute', top: 0, left: 0, width: 595.28, height: 841.89 }}
          fixed
        />

        {/* Espacio para encabezado del membrete */}
        <View style={{ height: 100 }} />

        {/* Protocolo arriba a la derecha */}
        <View style={{ position: 'absolute', top: m.top + 10, right: m.right, alignItems: 'flex-end' }}>
          <Text style={{ fontFamily: 'PublicSansSemiBold', fontSize: 7, color: '#888', letterSpacing: 0.5 }}>
            PROTOCOLO
          </Text>
          <Text style={{ fontFamily: 'PublicSansSemiBold', fontSize: 12, color: '#1a1a1a' }}>
            {data.protocol.number}
          </Text>
          <Text style={{ fontSize: 7, color: '#888' }}>{data.protocol.orderDate}</Text>
        </View>

        {/* Datos del paciente */}
        <View style={{ marginBottom: 14 }}>
          <WmRow label="Nombre:" value={data.patient.fullName} />
          <WmRow label="DNI:" value={data.patient.dni} />
          <WmRow label="Sexo:" value={sexLabel} />
          <WmRow label="Edad:" value={data.patient.age} />
          <WmRow label="F. Nacimiento:" value={data.patient.birthDate} />
          <WmRow
            label="Cobertura:"
            value={`${data.insurer.name}${data.insurer.affiliateNumber ? ` · ${data.insurer.affiliateNumber}` : ''}`}
          />
          {data.doctor.name ? (
            <WmRow
              label="Médico:"
              value={`${data.doctor.name}${data.doctor.mp ? ` · M.P. ${data.doctor.mp}` : ''}`}
            />
          ) : null}
          {data.doctor.diagnosis ? (
            <WmRow label="Diagnóstico:" value={data.doctor.diagnosis} />
          ) : null}
        </View>

        {/* Tabla de resultados */}
        {data.results.length > 0 ? (
          <OverlayResultsTable results={data.results} colors={tableColors} />
        ) : null}

        <View style={{ flexGrow: 1, minHeight: 20 }} />

        {/* Firma */}
        <View style={{ alignItems: 'center', marginTop: 10 }}>
          {data.signedBy.signatureSrc ? (
            <Image
              src={data.signedBy.signatureSrc}
              style={{ width: 140, height: 50, objectFit: 'contain', marginBottom: 2 }}
            />
          ) : (
            <View style={{ height: 40 }} />
          )}
          <Text style={{ fontFamily: 'PublicSansSemiBold', fontSize: 6.5, color: '#888', letterSpacing: 0.5, marginBottom: 4 }}>
            Responsable Técnico:
          </Text>
          <Text style={{ fontFamily: 'PublicSansSemiBold', fontSize: 10, color: '#1a1a1a' }}>
            {data.signedBy.name}
          </Text>
          {data.signedBy.matricula ? (
            <Text style={{ fontSize: 8, color: '#666', marginTop: 1 }}>MP {data.signedBy.matricula}</Text>
          ) : null}
        </View>

        {data.qrCodeDataUri ? (
          <View style={{ position: 'absolute', bottom: m.bottom + 5, right: m.right, alignItems: 'center' }}>
            <Image src={data.qrCodeDataUri} style={{ width: 50, height: 50 }} />
            <Text style={{ fontSize: 5, color: '#999', marginTop: 1 }}>Verificá tu informe</Text>
          </View>
        ) : null}
      </Page>
    </Document>
  );
}

// ── Modo estructurado (sin marca de agua) ────────────────────────────

export function InformeTemplate({ data }: { data: InformeData }) {
  const sexLabel = data.patient.sex ? SEX_LABEL[data.patient.sex] : '—';
  const accent = data.accent || C.primary;
  const accentSoft = data.accentSoft || C.primarySoft;
  const tc = data.layoutConfig?.['tabla.resultados'];
  const tHeaderBg = tc?.headerBg || accent;
  const tHeaderColor = tc?.headerColor || '#ffffff';
  const tBorder = tc?.borderColor || C.border;
  const tRowColor = tc?.rowColor || C.ink;
  const cc = data.layoutConfig?.['cuadros'];
  const cardTitle = cc?.color || accent;
  const cardBorder = cc?.borderColor || C.border;
  const cardBg = cc?.headerBg || C.bandBg;
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
        {/* Imagen de fondo (membrete) si existe */}
        {data.fondoSrc ? (
          <Image
            src={data.fondoSrc}
            style={{ position: 'absolute', top: 0, left: 0, width: 595.28, height: 841.89 }}
            fixed
          />
        ) : null}

        {/* Header + rule: si hay fondo se dejan 80pt de espacio; si no, header completo */}
        {data.fondoSrc ? (
          <View style={{ height: 80 }} />
        ) : (
          <>
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
            <View style={[styles.rule, { backgroundColor: accent }]} />
          </>
        )}

        {/* Patient/Animal + coverage cards */}
        <View style={styles.infoGrid}>
          <View style={[styles.infoCard, { borderColor: cardBorder, backgroundColor: cardBg }]}>
            {data.animalPatient ? (
              <>
                <Text style={[styles.cardTitle, { color: cardTitle }]}>PACIENTE ANIMAL</Text>
                <InfoRow label="Nombre" value={data.animalPatient.nombre} />
                <InfoRow label="Especie" value={data.animalPatient.especie} />
                {data.animalPatient.raza ? <InfoRow label="Raza" value={data.animalPatient.raza} /> : null}
                <InfoRow label="Propietario" value={data.animalPatient.propietario} />
                {data.animalPatient.propietarioDni ? <InfoRow label="DNI Propietario" value={data.animalPatient.propietarioDni} /> : null}
              </>
            ) : (
              <>
                <Text style={[styles.cardTitle, { color: cardTitle }]}>PACIENTE</Text>
                <InfoRow label="Apellido, Nombre" value={data.patient.fullName} />
                <InfoRow label="DNI" value={data.patient.dni} />
                <InfoRow label="Sexo · Edad" value={`${sexLabel} · ${data.patient.age}`} />
                <InfoRow label="Nacimiento" value={data.patient.birthDate} />
                {data.patient.streetAddress || data.patient.city ? (
                  <InfoRow
                    label="Domicilio"
                    value={[data.patient.streetAddress, data.patient.city].filter(Boolean).join(', ')}
                  />
                ) : null}
                {data.patient.phone ? <InfoRow label="Teléfono" value={data.patient.phone} /> : null}
              </>
            )}
          </View>

          <View style={[styles.infoCard, { borderColor: cardBorder, backgroundColor: cardBg }]}>
            <Text style={[styles.cardTitle, { color: cardTitle }]}>
              {data.animalPatient ? 'VETERINARIO' : 'COBERTURA Y MÉDICO'}
            </Text>
            {!data.animalPatient ? (
              <InfoRow
                label="Obra social"
                value={`${data.insurer.name}${
                  data.insurer.affiliateNumber ? ` · ${data.insurer.affiliateNumber}` : ''
                }`}
              />
            ) : null}
            <InfoRow
              label={data.animalPatient ? 'Veterinario' : 'Médico'}
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
        <View style={[styles.table, { borderColor: tBorder }]}>
          <View style={[styles.tableHeader, { backgroundColor: tHeaderBg }]} fixed>
            <Text style={[styles.th, styles.colName, { color: tHeaderColor }]}>PRÁCTICA</Text>
            <Text style={[styles.th, styles.colValue, { color: tHeaderColor }]}>RESULTADO</Text>
            <Text style={[styles.th, styles.colUnit, { color: tHeaderColor }]}>UNIDAD</Text>
            <Text style={[styles.th, styles.colRange, { color: tHeaderColor }]}>REFERENCIA</Text>
            <Text style={[styles.th, styles.colFlag, { color: tHeaderColor }]}>ESTADO</Text>
          </View>
          {data.results.map((r) => {
            const bStyle = badgeStyle(r.flag);
            const numeric = isNumericValue(r.value);
            return (
              <View
                key={r.nbuCode}
                style={[styles.tableRow, { borderTopColor: tBorder, flexDirection: 'column' }]}
                wrap={false}
              >
                <View style={{ flexDirection: 'row', width: '100%', alignItems: 'flex-start' }}>
                <View style={styles.colName}>
                  <Text style={[styles.practiceName, { color: tRowColor }]}>{r.name}</Text>
                  <Text style={styles.nbuCode}>NBU {r.nbuCode}</Text>
                  {r.methodology ? (
                    <Text style={styles.metaText}>Método: {r.methodology}</Text>
                  ) : null}
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
                  {r.range ? (
                    <Text style={styles.rangeText}>{r.range}</Text>
                  ) : r.referenceValue ? (
                    <Text style={{ fontSize: 7.5, color: C.muted }}>{r.referenceValue}</Text>
                  ) : (
                    <Text style={styles.rangeText}>—</Text>
                  )}
                  {r.unidades && r.unidades.length > 0 ? (
                    <View style={styles.unidadesBlock}>
                      {r.unidades.map((u, i) => {
                        const hasRange = u.rangeLow || u.rangeHigh;
                        const rangeStr = hasRange
                          ? `${u.rangeLow ? fmtNum(u.rangeLow) : '—'} – ${u.rangeHigh ? fmtNum(u.rangeHigh) : '—'}`
                          : null;
                        const uRef = rangeStr && u.referenceText
                          ? `${rangeStr}. ${u.referenceText}`
                          : rangeStr ?? u.referenceText ?? null;
                        return (
                          <View key={`ref-${u.nombre}-${i}`} style={styles.unidadRow} wrap={false}>
                            <Text style={{ fontSize: 7, color: C.muted }}>
                              {uRef ?? '—'}
                            </Text>
                          </View>
                        );
                      })}
                    </View>
                  ) : null}
                </View>
                <View style={styles.colFlag}>
                  {bStyle ? (
                    <Text style={[styles.badge, bStyle]}>{flagLabel(r.flag)}</Text>
                  ) : (
                    <Text style={styles.rangeText}>—</Text>
                  )}
                </View>
                </View>
                {r.notes ? (
                  <Text style={[styles.metaText, { marginTop: 4, width: '100%' }]}>
                    Obs.: {r.notes}
                  </Text>
                ) : null}
              </View>
            );
          })}
        </View>

        <View style={styles.flexSpacer} />
      </Page>
    </Document>
  );
}
