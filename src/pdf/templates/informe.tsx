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
  metodologia?: string | null;
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
  /** Total de unidades configuradas para esta práctica (incluyendo las sin valor cargado). */
  totalDefinedUnidades?: number;
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
    propietario?: string | null;
    propietarioDni?: string | null;
  } | null;
  solicitanteAgua?: {
    nombreApellido: string;
    razonSocial: string | null;
    cuit: string | null;
    domicilio: string | null;
    localidad: string | null;
    telefono: string | null;
  } | null;
  muestraAgua?: {
    tipoMuestra: string;
    fechaToma: string;
    fechaRecepcion: string;
    lugarToma: string | null;
    descripcionPunto: string | null;
    direccionPunto: string | null;
    motivoAnalisis: string;
    analisisFisicoquimico: boolean;
    analisisMicrobiologico: boolean;
    observaciones: string | null;
  } | null;
  /** Múltiples muestras con sus resultados individuales. Reemplaza muestraAgua cuando hay más de una. */
  muestras?: Array<{
    id: number;
    identificador: string | null;
    tipoMuestra: string;
    results: InformeResultRow[];
  }>;
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

// ── Agua / Efluentes: tabla de filas y columnas ──────────────────────

function formatAguaRef(
  rangeLow: string | null,
  rangeHigh: string | null,
  referenceText: string | null,
): string | null {
  if (rangeLow && rangeHigh) return `${fmtNum(rangeLow)} – ${fmtNum(rangeHigh)}`;
  if (!rangeLow && rangeHigh) return `<= ${fmtNum(rangeHigh)}`;
  if (rangeLow && !rangeHigh) return `>= ${fmtNum(rangeLow)}`;
  return referenceText ?? null;
}

interface AguaRow {
  parametro: string;
  isGroupHeader: boolean;
  isSubRow: boolean;
  metodo: string | null;
  resultado: string;
  unidad: string | null;
  referencia: string | null;
  flag: InformeFlag;
}

function buildAguaRows(results: InformeResultRow[]): AguaRow[] {
  const rows: AguaRow[] = [];
  for (const r of results) {
    const unidades = r.unidades ?? [];
    if (unidades.length === 0) {
      rows.push({
        parametro: r.name,
        isGroupHeader: false,
        isSubRow: false,
        metodo: r.methodology,
        resultado: r.value || '—',
        unidad: r.unit,
        referencia: r.range ?? r.referenceValue ?? null,
        flag: r.flag,
      });
    } else if (unidades.length === 1 && (r.totalDefinedUnidades ?? 1) <= 1) {
      // Single defined unidad → flat row using practice name as label
      const u = unidades[0];
      rows.push({
        parametro: r.name,
        isGroupHeader: false,
        isSubRow: false,
        metodo: u.metodologia ?? r.methodology,
        resultado: u.value || '—',
        unidad: u.simbolo ?? r.unit,
        referencia:
          formatAguaRef(u.rangeLow, u.rangeHigh, u.referenceText) ??
          r.range ??
          r.referenceValue ??
          null,
        flag: r.flag,
      });
    } else {
      rows.push({
        parametro: r.name,
        isGroupHeader: true,
        isSubRow: false,
        metodo: r.methodology,
        resultado: r.value || '',
        unidad: null,
        referencia: r.range ?? r.referenceValue ?? null,
        flag: r.flag,
      });
      for (const u of unidades) {
        rows.push({
          parametro: u.nombre,
          isGroupHeader: false,
          isSubRow: true,
          metodo: u.metodologia ?? null,
          resultado: u.value || '—',
          unidad: u.simbolo,
          referencia: formatAguaRef(u.rangeLow, u.rangeHigh, u.referenceText),
          flag: null,
        });
      }
    }
  }
  return rows;
}

function AguaEfluentesTable({
  results,
  accent,
  accentSoft,
  border,
  rowColor,
}: {
  results: InformeResultRow[];
  accent: string;
  accentSoft: string;
  border: string;
  rowColor: string;
}) {
  const rows = buildAguaRows(results);
  const thStyle = {
    color: '#ffffff',
    fontFamily: 'PublicSansSemiBold',
    fontSize: 7.5,
    letterSpacing: 0.3,
  };
  const cellV = { paddingVertical: 4, paddingHorizontal: 5 };
  const divR = { borderRightWidth: 0.5, borderRightColor: border };

  return (
    <View style={{ borderWidth: 0.5, borderColor: border, borderRadius: 3, overflow: 'hidden' }}>
      {/* Header row */}
      <View style={{ flexDirection: 'row', backgroundColor: accent }}>
        <View style={[{ width: '23%' }, cellV, divR]}>
          <Text style={thStyle}>Parámetro</Text>
        </View>
        <View style={[{ width: '32%' }, cellV, divR]}>
          <Text style={thStyle}>Método</Text>
        </View>
        <View style={[{ width: '13%' }, cellV, divR, { alignItems: 'flex-end' }]}>
          <Text style={thStyle}>Resultado</Text>
        </View>
        <View style={[{ width: '12%' }, cellV, divR, { alignItems: 'center' }]}>
          <Text style={thStyle}>Unidad</Text>
        </View>
        <View style={[{ flex: 1 }, cellV, { alignItems: 'flex-end' }]}>
          <Text style={thStyle}>Referencia</Text>
        </View>
      </View>

      {/* Data rows */}
      {rows.map((row, idx) => {
        const isAbnormal = row.flag && row.flag !== 'normal';
        const isBand = idx % 2 === 1;
        const rowBg = row.isGroupHeader
          ? accentSoft
          : isBand
            ? C.bandBg
            : '#ffffff';
        return (
          <View
            key={idx}
            style={{
              flexDirection: 'row',
              borderTopWidth: 0.5,
              borderTopColor: border,
              backgroundColor: rowBg,
              alignItems: 'stretch',
            }}
            wrap={false}
          >
            <View style={[{ width: '23%', justifyContent: 'center' }, cellV, divR]}>
              <Text
                style={{
                  fontSize: row.isGroupHeader ? 8.5 : 8,
                  color: rowColor,
                  fontFamily: row.isGroupHeader ? 'PublicSansSemiBold' : 'PublicSans',
                  paddingLeft: row.isSubRow ? 8 : 0,
                }}
              >
                {row.parametro}
              </Text>
            </View>
            <View style={[{ width: '32%', justifyContent: 'center' }, cellV, divR]}>
              <Text style={{ fontSize: 7, color: C.muted, lineHeight: 1.3 }}>
                {row.metodo ?? ''}
              </Text>
            </View>
            <View style={[{ width: '13%', justifyContent: 'center', alignItems: 'flex-end' }, cellV, divR]}>
              <Text
                style={{
                  fontSize: 8.5,
                  color: isAbnormal ? C.danger : rowColor,
                  fontFamily: isAbnormal ? 'PublicSansSemiBold' : 'PublicSans',
                }}
              >
                {row.isGroupHeader ? '' : row.resultado}
              </Text>
            </View>
            <View style={[{ width: '12%', justifyContent: 'center', alignItems: 'center' }, cellV, divR]}>
              <Text style={{ fontSize: 7, color: C.muted }}>
                {row.unidad ?? ''}
              </Text>
            </View>
            <View style={[{ flex: 1, justifyContent: 'center', alignItems: 'flex-end' }, cellV]}>
              <Text style={{ fontSize: 7.5, color: C.muted }}>
                {row.referencia ?? ''}
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

function OverlayResultsTable({ results, colors }: { results: InformeResultRow[]; colors: TableColors }) {
  const lbg = colors.headerBg;
  const lcolor = colors.headerColor;
  const bColor = colors.borderColor;
  const labelCell = { width: '26%', backgroundColor: lbg, paddingVertical: 6, paddingHorizontal: 8 };
  const labelText = { fontFamily: 'PublicSansSemiBold', fontSize: 7.5, color: lcolor, letterSpacing: 0.4 };
  const valueCell = { flex: 1, paddingVertical: 6, paddingHorizontal: 8 };
  const divider = { borderTopWidth: 0.5, borderTopColor: bColor };
  return (
    <View style={{ gap: 8 }}>
      {results.map((r) => {
        const bStyle = badgeStyle(r.flag);
        const hasUnidades = r.unidades && r.unidades.length > 0;
        const unidadesConRef = hasUnidades ? r.unidades!.filter(u => u.rangeLow || u.rangeHigh || u.referenceText) : [];
        const hasAnyRef = !!(r.range ?? r.referenceValue) || (hasUnidades && unidadesConRef.length > 0);
        return (
          <View key={r.nbuCode} style={{ borderWidth: 0.5, borderColor: bColor, borderRadius: 3, overflow: 'hidden' }} wrap={false}>
            <View style={{ flexDirection: 'row' }}>
              <View style={labelCell}><Text style={labelText}>PRÁCTICA</Text></View>
              <View style={valueCell}>
                <Text style={{ fontFamily: 'PublicSansSemiBold', fontSize: 9, color: colors.rowColor }}>{r.name}</Text>
                <Text style={{ fontSize: 6.5, color: bColor, marginTop: 1 }}>NBU {r.nbuCode}</Text>
                {r.methodology ? <Text style={{ fontSize: 6.5, color: colors.rowColor, marginTop: 1 }}>Método: {r.methodology}</Text> : null}
              </View>
            </View>
            <View style={[{ flexDirection: 'row' }, divider]}>
              <View style={labelCell}><Text style={labelText}>RESULTADO</Text></View>
              <View style={valueCell}>
                {hasUnidades ? (
                  <View>
                    {r.value ? (
                      <Text style={{ fontSize: 8, color: colors.rowColor, lineHeight: 1.35, marginBottom: 4 }}>{r.value}</Text>
                    ) : null}
                    {r.unidades!.map((u, i) => (
                      <View key={`${u.nombre}-${i}`} style={styles.unidadRow} wrap={false}>
                        <Text style={styles.unidadNombre}>{u.nombre}</Text>
                        <Text style={styles.unidadValue}>{u.value || '—'}</Text>
                        {u.simbolo ? <Text style={styles.unidadSimbolo}>{u.simbolo}</Text> : null}
                        {u.metodologia ? <Text style={{ fontSize: 6, color: bColor, marginLeft: 2 }}>Mét: {u.metodologia}</Text> : null}
                      </View>
                    ))}
                  </View>
                ) : (
                  <Text style={{ fontFamily: 'PublicSansSemiBold', fontSize: 9, color: colors.rowColor }}>{r.value || '—'}</Text>
                )}
              </View>
            </View>
            {!hasUnidades ? (
              <View style={[{ flexDirection: 'row' }, divider]}>
                <View style={labelCell}><Text style={labelText}>UNIDAD</Text></View>
                <View style={valueCell}><Text style={{ fontSize: 8, color: colors.rowColor }}>{r.unit ?? '—'}</Text></View>
              </View>
            ) : null}
            {hasAnyRef ? (
              <View style={[{ flexDirection: 'row' }, divider]}>
                <View style={labelCell}><Text style={labelText}>REFERENCIA</Text></View>
                <View style={valueCell}>
                  {hasUnidades ? (
                    <View>
                      {unidadesConRef.map((u, i) => {
                        const hasRange = u.rangeLow || u.rangeHigh;
                        const rangeStr = hasRange
                          ? `${u.rangeLow ? fmtNum(u.rangeLow) : '—'} – ${u.rangeHigh ? fmtNum(u.rangeHigh) : '—'}`
                          : null;
                        const uRef = rangeStr && u.referenceText
                          ? `${rangeStr}. ${u.referenceText}`
                          : rangeStr ?? u.referenceText;
                        return (
                          <View key={`ref-${u.nombre}-${i}`} style={styles.unidadRow} wrap={false}>
                            <Text style={styles.unidadNombre}>{u.nombre}</Text>
                            <Text style={{ fontSize: 7.5, color: colors.rowColor }}>{uRef}</Text>
                          </View>
                        );
                      })}
                      {(r.range ?? r.referenceValue) ? (
                        <Text style={{ fontSize: 8, color: colors.rowColor, marginTop: unidadesConRef.length > 0 ? 3 : 0 }}>{r.range ?? r.referenceValue}</Text>
                      ) : null}
                    </View>
                  ) : (
                    <Text style={{ fontSize: 8, color: colors.rowColor }}>{r.range ?? r.referenceValue}</Text>
                  )}
                </View>
              </View>
            ) : null}
            <View style={[{ flexDirection: 'row' }, divider]}>
              <View style={labelCell}><Text style={labelText}>ESTADO</Text></View>
              <View style={valueCell}>
                {bStyle ? (
                  <Text style={[styles.badge, bStyle]}>{flagLabel(r.flag)}</Text>
                ) : (
                  <Text style={{ fontSize: 8, color: colors.rowColor }}>—</Text>
                )}
              </View>
            </View>
            {r.notes ? (
              <View style={[{ flexDirection: 'row' }, divider]}>
                <View style={labelCell}><Text style={labelText}>OBSERVACIONES</Text></View>
                <View style={valueCell}><Text style={{ fontSize: 8, color: colors.rowColor, lineHeight: 1.35 }}>{r.notes}</Text></View>
              </View>
            ) : null}
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
  const isAgua = !!(data.muestraAgua || data.solicitanteAgua);

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

        {/* Observaciones de la orden */}
        {data.order?.notes ? (
          <View style={{ marginBottom: 10, borderLeftWidth: 2, borderLeftColor: '#888', paddingLeft: 8 }}>
            <Text style={{ fontFamily: 'PublicSansSemiBold', fontSize: 7.5, color: '#555', letterSpacing: 0.5, marginBottom: 2 }}>
              OBSERVACIONES
            </Text>
            <Text style={{ fontSize: 8.5, color: '#1a1a1a', lineHeight: 1.4 }}>{data.order.notes}</Text>
          </View>
        ) : null}

        {/* Tabla de resultados */}
        {isAgua && data.muestras && data.muestras.length > 1 ? (
          // Multi-muestra: una sección por muestra
          <View>
            {data.muestras.map((m, idx) => (
              <View key={m.id} style={{ marginBottom: idx < (data.muestras?.length ?? 0) - 1 ? 14 : 0 }}>
                <Text style={{ fontSize: 8, fontFamily: 'PublicSansSemiBold', color: tableColors.headerBg, marginBottom: 4 }}>
                  {m.identificador ? `Muestra: ${m.identificador}` : `Muestra ${idx + 1}: ${m.tipoMuestra}`}
                </Text>
                {m.results.length > 0 ? (
                  <AguaEfluentesTable
                    results={m.results}
                    accent={tableColors.headerBg}
                    accentSoft={C.primarySoft}
                    border={tableColors.borderColor}
                    rowColor={tableColors.rowColor}
                  />
                ) : (
                  <Text style={{ fontSize: 7, color: C.subtle }}>Sin resultados cargados.</Text>
                )}
              </View>
            ))}
          </View>
        ) : data.results.length > 0 ? (
          isAgua ? (
            <AguaEfluentesTable
              results={data.results}
              accent={tableColors.headerBg}
              accentSoft={C.primarySoft}
              border={tableColors.borderColor}
              rowColor={tableColors.rowColor}
            />
          ) : (
            <OverlayResultsTable results={data.results} colors={tableColors} />
          )
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

// ── Bloque de estudio (nuevo formato) ────────────────────────────────

function EstudioBlock({ r }: { r: InformeResultRow }) {
  const hasUnidades = r.unidades && r.unidades.length > 0;
  const isAbnormal =
    r.flag === 'high' || r.flag === 'low' || r.flag === 'critical_high' || r.flag === 'critical_low';
  const isCritical = r.flag === 'critical_high' || r.flag === 'critical_low';
  const flagColor = isCritical ? C.danger : C.warning;

  return (
    <View style={{ marginBottom: 14 }}>
      {/* Header: name + método */}
      <View
        wrap={false}
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          paddingBottom: 3,
          borderBottomWidth: 1.5,
          borderBottomColor: C.ink,
          marginBottom: 2,
        }}
      >
        <Text style={{ fontFamily: 'PublicSansSemiBold', fontSize: 10.5, color: C.ink }}>
          Estudio: {r.name}.
        </Text>
        {r.methodology ? (
          <Text
            style={{
              fontSize: 8.5,
              color: C.muted,
              textAlign: 'right',
              maxWidth: '45%',
              lineHeight: 1.3,
            }}
          >
            Método: {r.methodology}
          </Text>
        ) : null}
      </View>

      {/* Valor principal cuando hay sub-unidades (ej: sedimento urinario) */}
      {hasUnidades && r.value ? (
        <View wrap={false} style={{ paddingVertical: 3, borderBottomWidth: 0.3, borderBottomColor: C.border }}>
          <Text style={{ fontSize: 9, fontFamily: 'PublicSansSemiBold', color: C.ink, lineHeight: 1.4 }}>
            {r.value}
          </Text>
        </View>
      ) : null}

      {/* Rows */}
      {hasUnidades ? (
        r.unidades!.map((u, i) => {
          const hasRange = u.rangeLow || u.rangeHigh;
          const rangeStr = hasRange
            ? `${u.rangeLow ? fmtNum(u.rangeLow) : '—'} a ${u.rangeHigh ? fmtNum(u.rangeHigh) : '—'}`
            : null;
          const ref =
            rangeStr && u.referenceText
              ? `${rangeStr}. ${u.referenceText}`
              : (rangeStr ?? u.referenceText ?? '');
          // Prose layout for long text values to avoid narrow-column wrapping
          const isProse = !isNumericValue(u.value) && u.value.length > 12;

          return (
            <View
              key={`${u.nombre}-${i}`}
              wrap={false}
              style={{
                flexDirection: 'row',
                alignItems: 'flex-start',
                paddingVertical: 3,
                borderBottomWidth: 0.3,
                borderBottomColor: C.border,
              }}
            >
              <Text style={{ width: '42%', fontSize: 9, color: C.muted, paddingRight: 6, lineHeight: 1.4 }}>
                {u.nombre}:
              </Text>
              {isProse ? (
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 9, fontFamily: 'PublicSansSemiBold', color: C.ink, lineHeight: 1.4 }}>
                    {u.value || '—'}{u.simbolo ? ` ${u.simbolo}` : ''}
                  </Text>
                  {ref ? (
                    <Text style={{ fontSize: 7.5, color: C.subtle, lineHeight: 1.3, marginTop: 1 }}>{ref}</Text>
                  ) : null}
                </View>
              ) : (
                <>
                  <Text
                    style={{
                      flex: 1,
                      fontSize: isNumericValue(u.value) ? 10 : 9,
                      fontFamily: 'PublicSansSemiBold',
                      color: C.ink,
                      textAlign: 'right',
                    }}
                  >
                    {u.value || '—'}
                  </Text>
                  <Text style={{ width: 38, fontSize: 8, color: C.muted, textAlign: 'center' }}>
                    {u.simbolo ?? ''}
                  </Text>
                  <Text
                    style={{
                      width: 120,
                      fontSize: 8,
                      color: C.subtle,
                      textAlign: 'right',
                      lineHeight: 1.3,
                    }}
                  >
                    {ref}
                  </Text>
                </>
              )}
            </View>
          );
        })
      ) : (
        <View
          wrap={false}
          style={{
            flexDirection: 'row',
            alignItems: 'flex-start',
            paddingVertical: 3,
            borderBottomWidth: 0.3,
            borderBottomColor: C.border,
          }}
        >
          {isNumericValue(r.value) ? (
            <>
              <Text style={{ flex: 1, fontSize: 9, color: C.muted }}>Resultado:</Text>
              <Text
                style={{
                  width: 90,
                  fontSize: 10,
                  fontFamily: 'PublicSansSemiBold',
                  color: isAbnormal ? flagColor : C.ink,
                  textAlign: 'right',
                }}
              >
                {r.value || '—'}
              </Text>
              <Text style={{ width: 38, fontSize: 8, color: C.muted, textAlign: 'center' }}>
                {r.unit ?? ''}
              </Text>
              <Text style={{ width: 120, fontSize: 8, color: C.subtle, textAlign: 'right', lineHeight: 1.3 }}>
                {r.range ?? ''}
              </Text>
            </>
          ) : (
            <>
              <Text style={{ width: '42%', fontSize: 9, color: C.muted, paddingRight: 6 }}>Resultado:</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 9, fontFamily: 'PublicSansSemiBold', color: isAbnormal ? flagColor : C.ink, lineHeight: 1.4 }}>
                  {r.value || '—'}{r.unit ? ` ${r.unit}` : ''}
                </Text>
                {r.range ? (
                  <Text style={{ fontSize: 7.5, color: C.subtle, lineHeight: 1.3, marginTop: 1 }}>{r.range}</Text>
                ) : null}
              </View>
            </>
          )}
        </View>
      )}

      {r.referenceValue ? (
        <View style={{ marginTop: 3 }}>
          {r.referenceValue.split('\n').map((line, i) => (
            <Text key={i} style={{ fontSize: 8, color: C.warning, lineHeight: 1.4 }}>
              {i === 0 ? `Valor de referencia: ${line}` : line}
            </Text>
          ))}
        </View>
      ) : null}

      {r.notes ? (
        <Text style={{ fontSize: 8, color: C.muted, marginTop: 3, lineHeight: 1.4 }}>
          Observaciones: {r.notes}
        </Text>
      ) : null}

    </View>
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
  const isAgua = !!(data.muestraAgua || data.solicitanteAgua);
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

        {/* Header: si hay fondo el paddingTop de la página ya deja el espacio necesario */}
        {data.fondoSrc ? null : (
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
            </View>
            <View style={[styles.rule, { backgroundColor: accent }]} />
          </>
        )}

        {/* Info cards: Paciente/Animal/Solicitante + Cobertura/Vet/Muestra */}
        <View style={styles.infoGrid}>
          <View style={[styles.infoCard, { borderColor: cardBorder, backgroundColor: cardBg }]}>
            {data.solicitanteAgua ? (
              <>
                <Text style={[styles.cardTitle, { color: cardTitle }]}>SOLICITANTE</Text>
                <InfoRow label="Nombre" value={data.solicitanteAgua.nombreApellido} />
                {data.solicitanteAgua.razonSocial ? <InfoRow label="Razón social" value={data.solicitanteAgua.razonSocial} /> : null}
                {data.solicitanteAgua.cuit ? <InfoRow label="CUIT" value={data.solicitanteAgua.cuit} /> : null}
                {data.solicitanteAgua.domicilio ? <InfoRow label="Domicilio" value={data.solicitanteAgua.domicilio} /> : null}
                {data.solicitanteAgua.localidad ? <InfoRow label="Localidad" value={data.solicitanteAgua.localidad} /> : null}
                {data.solicitanteAgua.telefono ? <InfoRow label="Teléfono" value={data.solicitanteAgua.telefono} /> : null}
              </>
            ) : data.animalPatient ? (
              <>
                <Text style={[styles.cardTitle, { color: cardTitle }]}>PACIENTE ANIMAL</Text>
                <InfoRow label="Nombre" value={data.animalPatient.nombre} />
                <InfoRow label="Especie" value={data.animalPatient.especie} />
                {data.animalPatient.raza ? <InfoRow label="Raza" value={data.animalPatient.raza} /> : null}
                {data.animalPatient.propietario ? <InfoRow label="Propietario" value={data.animalPatient.propietario} /> : null}
                {data.animalPatient.propietarioDni ? <InfoRow label="DNI Propietario" value={data.animalPatient.propietarioDni} /> : null}
              </>
            ) : (
              <>
                <Text style={[styles.cardTitle, { color: cardTitle }]}>PACIENTE</Text>
                <InfoRow label="Apellido, Nombre" value={data.patient.fullName} />
                <InfoRow label="DNI" value={data.patient.dni} />
                <InfoRow label="Sexo · Edad" value={`${sexLabel} · ${data.patient.age}`} />
                <InfoRow label="Nacimiento" value={data.patient.birthDate} />
              </>
            )}
          </View>

          <View style={[styles.infoCard, { borderColor: cardBorder, backgroundColor: cardBg }]}>
            {data.muestraAgua ? (
              <>
                <Text style={[styles.cardTitle, { color: cardTitle }]}>DATOS DE LA MUESTRA</Text>
                <InfoRow label="Tipo" value={data.muestraAgua.tipoMuestra} />
                <InfoRow label="Fecha toma" value={data.muestraAgua.fechaToma} />
                <InfoRow label="Fecha recepción" value={data.muestraAgua.fechaRecepcion} />
                {data.muestraAgua.lugarToma ? <InfoRow label="Lugar toma" value={data.muestraAgua.lugarToma} /> : null}
                {data.muestraAgua.descripcionPunto ? <InfoRow label="Punto" value={data.muestraAgua.descripcionPunto} /> : null}
                {data.muestraAgua.direccionPunto ? <InfoRow label="Dirección" value={data.muestraAgua.direccionPunto} /> : null}
                <InfoRow label="Motivo" value={data.muestraAgua.motivoAnalisis} />
                {data.muestraAgua.observaciones ? <InfoRow label="Obs." value={data.muestraAgua.observaciones} /> : null}
              </>
            ) : (
              <>
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
              </>
            )}
          </View>
        </View>

        {/* Observaciones de la orden */}
        {data.order?.notes ? (
          <View
            style={{
              marginBottom: 10,
              borderRadius: 3,
              borderWidth: 0.5,
              borderColor: tBorder,
              backgroundColor: accentSoft,
              paddingVertical: 6,
              paddingHorizontal: 10,
            }}
            wrap={false}
          >
            <Text style={{ fontFamily: 'PublicSansSemiBold', fontSize: 7.5, color: accent, letterSpacing: 0.8, marginBottom: 3 }}>
              OBSERVACIONES
            </Text>
            <Text style={{ fontSize: 8.5, color: C.ink, lineHeight: 1.4 }}>{data.order.notes}</Text>
          </View>
        ) : null}

        {/* Results */}
        <Text style={[styles.resultsTitle, { color: accent }]}>Resultados</Text>

        {data.muestras && data.muestras.length > 1 ? (
          data.muestras.map((m, mIdx) => (
            <View key={m.id} style={{ marginBottom: mIdx < (data.muestras?.length ?? 0) - 1 ? 10 : 0 }}>
              <Text style={{ fontSize: 8, fontFamily: 'PublicSansSemiBold', color: accent, marginBottom: 3, paddingBottom: 2, borderBottomWidth: 0.5, borderBottomColor: tBorder }}>
                {m.identificador ? `Muestra: ${m.identificador}` : `Muestra ${mIdx + 1}: ${m.tipoMuestra}`}
              </Text>
              <View style={{ gap: 0 }}>
                {m.results.map((r) => (
                  <EstudioBlock key={`${m.id}-${r.nbuCode}`} r={r} />
                ))}
              </View>
            </View>
          ))
        ) : (
          <View style={{ gap: 0 }}>
            {data.results.map((r) => (
              <EstudioBlock key={r.nbuCode} r={r} />
            ))}
          </View>
        )}

        {/* Firma + protocolo al final */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 6 }}>
          <Text style={{ fontSize: 8, color: C.muted }}>
            Firma: {data.signedBy.name}
            {data.signedBy.matricula ? ` (MP: ${data.signedBy.matricula})` : ''}
          </Text>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ fontSize: 7, color: C.subtle }}>
              Protocolo N° {data.protocol.number}  ·  {data.protocol.orderDate}
            </Text>
            <Text style={{ fontSize: 6, color: C.subtle }}>
              Emitido: {data.protocol.issuedAt}
            </Text>
          </View>
        </View>

        <View style={styles.flexSpacer} />
      </Page>
    </Document>
  );
}
