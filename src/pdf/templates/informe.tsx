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
  layoutConfig?: Record<string, { x: number; y: number; fontSize?: number; color?: string; prefix?: string }> | null;
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

const overlayTableStyles = StyleSheet.create({
  headerRow: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: '#999', paddingBottom: 3, marginBottom: 4 },
  thText: { fontFamily: 'PublicSansSemiBold', fontSize: 7, color: '#333', letterSpacing: 0.3 },
  dataRow: { flexDirection: 'row', paddingVertical: 3, borderBottomWidth: 0.25, borderBottomColor: '#ddd' },
  cellName: { width: '30%', paddingRight: 4 },
  cellValue: { width: '25%', paddingRight: 4 },
  cellUnit: { width: '12%', paddingRight: 4 },
  cellRange: { width: '18%', paddingRight: 4 },
  cellFlag: { width: '15%' },
  nameText: { fontFamily: 'PublicSansSemiBold', fontSize: 8, color: '#1a1a1a' },
  codeText: { fontSize: 6.5, color: '#888', marginTop: 1 },
  valueText: { fontFamily: 'PublicSansSemiBold', fontSize: 9, color: '#1a1a1a' },
  normalText: { fontSize: 7.5, color: '#555' },
  flagNormal: { fontSize: 7, color: C.success },
  flagWarning: { fontSize: 7, color: C.warning },
  flagDanger: { fontSize: 7, color: C.danger },
});

function OverlayResultsTable({ results }: { results: InformeResultRow[] }) {
  return (
    <View>
      <View style={overlayTableStyles.headerRow}>
        <Text style={[overlayTableStyles.thText, overlayTableStyles.cellName]}>PRÁCTICA</Text>
        <Text style={[overlayTableStyles.thText, overlayTableStyles.cellValue]}>RESULTADO</Text>
        <Text style={[overlayTableStyles.thText, overlayTableStyles.cellUnit]}>UNIDAD</Text>
        <Text style={[overlayTableStyles.thText, overlayTableStyles.cellRange]}>REFERENCIA</Text>
        <Text style={[overlayTableStyles.thText, overlayTableStyles.cellFlag]}>ESTADO</Text>
      </View>
      {results.map((r) => {
        let flagStyle = overlayTableStyles.normalText;
        if (r.flag === 'normal') flagStyle = overlayTableStyles.flagNormal;
        else if (r.flag === 'low' || r.flag === 'high') flagStyle = overlayTableStyles.flagWarning;
        else if (r.flag === 'critical_low' || r.flag === 'critical_high') flagStyle = overlayTableStyles.flagDanger;
        return (
          <View key={r.nbuCode} style={overlayTableStyles.dataRow} wrap={false}>
            <View style={overlayTableStyles.cellName}>
              <Text style={overlayTableStyles.nameText}>{r.name}</Text>
              <Text style={overlayTableStyles.codeText}>NBU {r.nbuCode}</Text>
            </View>
            <View style={overlayTableStyles.cellValue}>
              <Text style={overlayTableStyles.valueText}>{r.value || '—'}</Text>
            </View>
            <View style={overlayTableStyles.cellUnit}>
              <Text style={overlayTableStyles.normalText}>{r.unit ?? '—'}</Text>
            </View>
            <View style={overlayTableStyles.cellRange}>
              <Text style={overlayTableStyles.normalText}>{r.range ?? '—'}</Text>
            </View>
            <View style={overlayTableStyles.cellFlag}>
              <Text style={flagStyle}>{flagLabel(r.flag)}</Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

function WatermarkInforme({ data }: { data: InformeData }) {
  const campos = data.layoutConfig ?? {};
  const entries = Object.entries(campos);
  const textFields = entries.filter(([k]) => !k.startsWith('tabla.') && k !== 'firma.imagen' && k !== 'qr');
  const tableField = entries.find(([k]) => k === 'tabla.resultados');
  const signField = entries.find(([k]) => k === 'firma.imagen');
  const qrField = entries.find(([k]) => k === 'qr');

  return (
    <Document
      title={`Informe ${data.protocol.number}`}
      author={data.lab.legalName}
      subject="Informe de laboratorio"
    >
      <Page
        size="A4"
        style={{ fontFamily: 'PublicSans', fontSize: 9.5, color: C.ink }}
      >
        {/* Marca de agua como fondo */}
        <Image
          src={data.fondoSrc!}
          style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
          fixed
        />

        {/* Campos de texto posicionados */}
        {textFields.map(([key, pos]) => {
          const value = resolveFieldValue(key, data);
          if (value === null) return null;
          const displayText = pos.prefix ? `${pos.prefix}${value}` : value;
          return (
            <View key={key} style={{ position: 'absolute', left: pos.x, top: pos.y }}>
              <Text style={{ fontSize: pos.fontSize ?? 9, color: pos.color ?? '#000000', fontFamily: 'PublicSans' }}>
                {displayText}
              </Text>
            </View>
          );
        })}

        {/* Tabla de resultados */}
        {tableField && data.results.length > 0 ? (
          <View style={{ position: 'absolute', left: tableField[1].x, top: tableField[1].y, width: 500 }}>
            <OverlayResultsTable results={data.results} />
          </View>
        ) : null}

        {/* Firma imagen */}
        {signField && data.signedBy.signatureSrc ? (
          <View style={{ position: 'absolute', left: signField[1].x, top: signField[1].y }}>
            <Image src={data.signedBy.signatureSrc} style={{ width: 140, height: 50, objectFit: 'contain' }} />
          </View>
        ) : null}

        {/* QR */}
        {qrField && data.qrCodeDataUri ? (
          <View style={{ position: 'absolute', left: qrField[1].x, top: qrField[1].y }}>
            <Image src={data.qrCodeDataUri} style={{ width: 55, height: 55 }} />
          </View>
        ) : null}
      </Page>
    </Document>
  );
}

// ── Modo estructurado (sin marca de agua) ────────────────────────────

export function InformeTemplate({ data }: { data: InformeData }) {
  // Cuando hay marca de agua: solo fondo + campos posicionados.
  if (data.fondoSrc) {
    return <WatermarkInforme data={data} />;
  }

  // Sin marca de agua: template estructurado completo.
  const sexLabel = data.patient.sex ? SEX_LABEL[data.patient.sex] : '—';
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

        <View style={styles.flexSpacer} />

        {/* Footer */}
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
