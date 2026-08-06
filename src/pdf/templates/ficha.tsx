import { Document, Image, Page, StyleSheet, Text, View } from '@react-pdf/renderer';

export interface FichaPracticeRow {
  nbuCode: string;
  name: string;
  section: string | null;
  isElaborated: boolean;
  authorizationStatus: 'no_aplica' | 'pendiente' | 'autorizada' | 'rechazada';
  authorizationCode: string | null;
}

export interface FichaData {
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
    isUrgent: boolean;
  };
  patient: {
    fullName: string;
    dni: string;
    sex: 'F' | 'M' | 'X' | null;
    age: string;
    birthDate: string;
    phone: string | null;
  };
  insurer: {
    name: string;
    affiliateNumber: string | null;
  };
  doctor: {
    name: string | null;
    mp: string | null;
    diagnosis: string | null;
    notes: string | null;
  };
  practices: FichaPracticeRow[];
  printedAt: string;
  accent?: string | null;
  accentSoft?: string | null;
}

const C = {
  primary: '#1a2b5b',
  ink: '#111111',
  muted: '#444444',
  subtle: '#888888',
  border: '#bbbbbb',
  bg: '#f8f8f8',
};

const styles = StyleSheet.create({
  page: {
    paddingTop: 18,
    paddingBottom: 36,
    paddingHorizontal: 28,
    fontFamily: 'Roboto',
    fontSize: 9,
    color: C.ink,
    lineHeight: 1.3,
  },

  // ── Header ──
  header: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 6 },
  logo: { width: 44, height: 44, marginRight: 10, objectFit: 'contain' },
  labBlock: { flex: 1 },
  labName: { fontSize: 11, fontWeight: 'bold', color: C.ink, marginBottom: 2 },
  labSub: { fontSize: 7.5, color: C.muted },
  orderBadge: {
    alignItems: 'flex-end',
  },
  orderNum: { fontSize: 11, fontWeight: 'bold', color: C.primary },
  orderDate: { fontSize: 8, color: C.muted },
  urgentText: { fontSize: 8, fontWeight: 'bold', color: '#cc0000', marginTop: 2 },

  // ── Rule ──
  rule: { height: 1.5, backgroundColor: C.primary, marginBottom: 8 },

  // ── Patient block ──
  patientName: { fontSize: 14, fontWeight: 'bold', color: C.ink, marginBottom: 3 },
  infoRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 2 },
  infoChunk: { marginRight: 16 },
  infoLabel: { fontSize: 7.5, color: C.muted },
  infoValue: { fontSize: 8.5, color: C.ink, fontWeight: 'bold' },

  // ── Two columns ──
  twoCol: { flexDirection: 'row', gap: 12, marginBottom: 8 },
  colLeft: { flex: 1 },
  colRight: { flex: 1 },

  // ── Comprobante banner ──
  banner: {
    borderWidth: 1.5,
    borderColor: C.ink,
    paddingVertical: 5,
    paddingHorizontal: 10,
    marginBottom: 8,
    alignItems: 'center',
  },
  bannerText: { fontSize: 8, fontWeight: 'bold', color: C.ink, textAlign: 'center', letterSpacing: 0.3 },

  // ── Extraction row ──
  extractionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
    paddingBottom: 3,
    borderBottomWidth: 0.5,
    borderBottomColor: C.border,
  },
  extractionChunk: { flexDirection: 'row', gap: 4 },
  extractionLabel: { fontSize: 7.5, color: C.muted },
  extractionValue: { fontSize: 8, color: C.ink, fontWeight: 'bold' },
  extractionBlank: {
    width: 80,
    borderBottomWidth: 0.5,
    borderBottomColor: C.ink,
    marginLeft: 4,
  },

  // ── Table ──
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: C.primary,
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  thNbu: { width: 42, color: '#fff', fontSize: 7.5, fontWeight: 'bold' },
  thName: { flex: 1, color: '#fff', fontSize: 7.5, fontWeight: 'bold' },
  thSection: { width: 70, color: '#fff', fontSize: 7.5, fontWeight: 'bold' },
  thVal: { width: 50, color: '#fff', fontSize: 7.5, fontWeight: 'bold', textAlign: 'center' },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 5,
    paddingHorizontal: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: C.border,
    alignItems: 'center',
    minHeight: 20,
  },
  zebraRow: { backgroundColor: C.bg },
  cellNbu: { width: 42 },
  cellName: { flex: 1, paddingRight: 4 },
  cellSection: { width: 70, paddingRight: 4 },
  cellVal: {
    width: 50,
    borderLeftWidth: 0.5,
    borderLeftColor: C.border,
    height: '100%',
    alignItems: 'center',
  },
  nbuText: { fontSize: 8, color: C.muted },
  practicaName: { fontSize: 9, color: C.ink },
  sectionText: { fontSize: 7.5, color: C.muted },
  elab: { fontSize: 7, color: C.muted, marginTop: 1 },

  // ── Footer ──
  footer: {
    position: 'absolute',
    bottom: 14,
    left: 28,
    right: 28,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    borderTopWidth: 1,
    borderTopColor: C.border,
    paddingTop: 4,
  },
  footerLine: {
    width: 130,
    borderBottomWidth: 0.5,
    borderBottomColor: C.ink,
    marginBottom: 2,
    marginTop: 20,
  },
  footerLabel: { fontSize: 7, color: C.muted },
  footerMeta: { fontSize: 7, color: C.muted, textAlign: 'right' },
});

const SEX_LABEL: Record<'F' | 'M' | 'X', string> = { F: 'Femenina', M: 'Masculino', X: 'Otro' };
const SEX_PREFIX: Record<'F' | 'M' | 'X', string> = { F: 'Sra.', M: 'Sr.', X: '' };

function InfoChunk({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoChunk}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value || '—'}</Text>
    </View>
  );
}

export function FichaTemplate({ data }: { data: FichaData }) {
  const accent = data.accent || C.primary;
  const prefix = data.patient.sex ? SEX_PREFIX[data.patient.sex] : '';
  const sexLabel = data.patient.sex ? SEX_LABEL[data.patient.sex] : '—';

  return (
    <Document title={`Ficha ${data.protocol.number}`} author={data.lab.legalName} subject="Ficha de trabajo">
      <Page size="A4" style={styles.page}>

        {/* ── Header ── */}
        <View style={styles.header}>
          {data.lab.logoSrc ? <Image src={data.lab.logoSrc} style={styles.logo} /> : null}
          <View style={styles.labBlock}>
            <Text style={styles.labName}>{data.lab.legalName}</Text>
            <Text style={styles.labSub}>{data.lab.address} — {data.lab.cityProvince}</Text>
            {(data.lab.phone || data.lab.cuit) ? (
              <Text style={styles.labSub}>
                {data.lab.cuit ? `CUIT ${data.lab.cuit}` : ''}
                {data.lab.cuit && data.lab.phone ? '  ·  ' : ''}
                {data.lab.phone ? `Tel. ${data.lab.phone}` : ''}
              </Text>
            ) : null}
          </View>
          <View style={styles.orderBadge}>
            <Text style={[styles.orderNum, { color: accent }]}>N° {data.protocol.number}</Text>
            <Text style={styles.orderDate}>{data.protocol.orderDate}</Text>
            {data.protocol.isUrgent ? <Text style={styles.urgentText}>● URGENTE</Text> : null}
          </View>
        </View>

        {/* ── Rule ── */}
        <View style={[styles.rule, { backgroundColor: accent }]} />

        {/* ── Patient + Doctor ── */}
        <View style={styles.twoCol}>
          <View style={styles.colLeft}>
            <Text style={styles.patientName}>{prefix ? `${prefix} ` : ''}{data.patient.fullName}</Text>
            <View style={styles.infoRow}>
              <InfoChunk label="Nacim." value={data.patient.birthDate} />
              <InfoChunk label="Edad" value={data.patient.age} />
              <InfoChunk label="Sexo" value={sexLabel} />
            </View>
            <View style={styles.infoRow}>
              <InfoChunk label="DNI" value={data.patient.dni} />
              {data.patient.phone ? <InfoChunk label="Tel." value={data.patient.phone} /> : null}
            </View>
          </View>
          <View style={styles.colRight}>
            <View style={styles.infoRow}>
              <InfoChunk
                label="Cobertura"
                value={data.insurer.name + (data.insurer.affiliateNumber ? ` · N° ${data.insurer.affiliateNumber}` : '')}
              />
            </View>
            {data.doctor.name ? (
              <View style={styles.infoRow}>
                <InfoChunk
                  label="Médico"
                  value={[data.doctor.name, data.doctor.mp ? `M.P. ${data.doctor.mp}` : null].filter(Boolean).join(' · ')}
                />
              </View>
            ) : null}
          </View>
        </View>

        {/* ── Comprobante banner ── */}
        <View style={styles.banner}>
          <Text style={styles.bannerText}>
            PARA AGILIZAR LA ENTREGA DE SUS ANÁLISIS CONSERVE ESTE COMPROBANTE
          </Text>
        </View>

        {/* ── Extraction row ── */}
        <View style={styles.extractionRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={styles.extractionLabel}>Extracción: </Text>
            <View style={styles.extractionBlank} />
          </View>
          {data.doctor.notes ? (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={styles.extractionLabel}>Notas: </Text>
              <Text style={styles.extractionValue}>{data.doctor.notes}</Text>
            </View>
          ) : null}
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={styles.extractionLabel}>Retirar el: </Text>
            <View style={styles.extractionBlank} />
          </View>
        </View>

        {/* ── Practices table ── */}
        <View style={[styles.tableHeader, { backgroundColor: accent }]} fixed>
          <Text style={styles.thNbu}>NBU</Text>
          <Text style={styles.thName}>PRÁCTICA</Text>
          <Text style={styles.thSection}>SECCIÓN</Text>
          <Text style={[styles.thVal, { borderLeftWidth: 0.5, borderLeftColor: 'rgba(255,255,255,0.3)', paddingLeft: 4 }]}>VALOR</Text>
        </View>

        {data.practices.map((p, idx) => (
          <View
            key={`${p.nbuCode}-${idx}`}
            style={idx % 2 === 1 ? [styles.tableRow, styles.zebraRow] : styles.tableRow}
            wrap={false}
          >
            <View style={styles.cellNbu}>
              <Text style={styles.nbuText}>{p.nbuCode}</Text>
            </View>
            <View style={styles.cellName}>
              <Text style={styles.practicaName}>{p.name}</Text>
              {!p.isElaborated ? <Text style={styles.elab}>Derivar</Text> : null}
              {p.authorizationStatus === 'pendiente' ? <Text style={[styles.elab, { color: '#b45309' }]}>Autorización pendiente</Text> : null}
              {p.authorizationStatus === 'rechazada' ? <Text style={[styles.elab, { color: '#b91c1c' }]}>Autorización rechazada</Text> : null}
              {p.authorizationCode ? <Text style={styles.elab}>Cód. {p.authorizationCode}</Text> : null}
            </View>
            <View style={styles.cellSection}>
              <Text style={styles.sectionText}>{p.section ?? '—'}</Text>
            </View>
            <View style={styles.cellVal} />
          </View>
        ))}

        {/* ── Footer ── */}
        <View style={styles.footer} fixed>
          <View>
            <View style={styles.footerLine} />
            <Text style={styles.footerLabel}>Firma y aclaración · Bioquímico responsable</Text>
          </View>
          <View>
            <View style={styles.footerLine} />
            <Text style={styles.footerLabel}>Fecha y hora de extracción</Text>
          </View>
          <Text style={styles.footerMeta}>Impreso: {data.printedAt}</Text>
        </View>

      </Page>
    </Document>
  );
}
