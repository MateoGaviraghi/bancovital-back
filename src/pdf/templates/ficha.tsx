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
}

const C = {
  primary: '#0db5b0',
  primarySoft: '#e4f7f6',
  ink: '#1a2b3c',
  muted: '#4a6279',
  subtle: '#8ba3b5',
  border: '#dde4ea',
  bandBg: '#f4f7f9',
  success: '#15803d',
  successSoft: '#dcfce7',
  warning: '#b45309',
  warningSoft: '#fef3c7',
  danger: '#b91c1c',
  dangerSoft: '#fee2e2',
};

const styles = StyleSheet.create({
  page: {
    paddingTop: 32,
    paddingBottom: 60,
    paddingHorizontal: 36,
    fontFamily: 'Roboto',
    fontSize: 10,
    color: C.ink,
    lineHeight: 1.4,
  },
  header: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 },
  logo: { width: 52, height: 52, marginRight: 12, objectFit: 'contain' },
  labInfo: { flexGrow: 1 },
  legalName: { fontSize: 15, fontWeight: 'bold', color: C.ink, lineHeight: 1.2, marginBottom: 4 },
  labLine: { fontSize: 8.5, color: C.muted, lineHeight: 1.35, marginBottom: 2 },
  rule: { height: 2, backgroundColor: C.primary, borderRadius: 1, marginBottom: 6 },
  protocolBadge: {
    flexDirection: 'column',
    alignItems: 'flex-end',
    backgroundColor: C.primarySoft,
    borderRadius: 3,
    paddingVertical: 3,
    paddingHorizontal: 7,
    marginLeft: 12,
  },
  protocolLabel: { fontSize: 6, color: C.primary, fontWeight: 'bold', letterSpacing: 1.2 },
  protocolNumber: { fontSize: 9, fontWeight: 'bold', color: C.primary },
  protocolDate: { fontSize: 7, color: C.muted },
  urgentBadge: {
    fontSize: 7,
    fontWeight: 'bold',
    color: C.danger,
    marginTop: 2,
    letterSpacing: 0.8,
  },
  infoGrid: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  infoCard: {
    flex: 1,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 6,
    backgroundColor: C.bandBg,
    padding: 12,
  },
  cardTitle: {
    fontSize: 7.5,
    color: C.primary,
    letterSpacing: 1.5,
    fontWeight: 'bold',
    marginBottom: 7,
  },
  row: { flexDirection: 'row', marginVertical: 1.5 },
  rowLabel: { width: 96, color: C.muted, fontSize: 9 },
  rowValue: { flex: 1, fontSize: 9, color: C.ink },
  practicesTitle: {
    fontSize: 7.5,
    color: C.primary,
    letterSpacing: 1.5,
    fontWeight: 'bold',
    marginBottom: 6,
  },
  table: { borderWidth: 1, borderColor: C.border, borderRadius: 6, overflow: 'hidden' },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: C.primary,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  th: { color: '#ffffff', fontSize: 8, fontWeight: 'bold', letterSpacing: 0.5 },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderTopWidth: 0.5,
    borderTopColor: C.border,
    alignItems: 'center',
  },
  zebraRow: { backgroundColor: C.bandBg },
  colPractica: { width: '38%', paddingRight: 8 },
  colNbu: { width: '13%', paddingRight: 4 },
  colSeccion: { width: '20%', paddingRight: 4 },
  colElab: { width: '15%', paddingRight: 4 },
  colAuth: { width: '14%' },
  practicaName: { fontSize: 9.5, fontWeight: 'bold', color: C.ink },
  nbuText: { fontSize: 7.5, color: C.subtle, marginTop: 1 },
  sectionText: { fontSize: 8.5, color: C.muted },
  badge: {
    borderRadius: 4,
    paddingVertical: 2,
    paddingHorizontal: 5,
    fontSize: 7.5,
    fontWeight: 'bold',
    letterSpacing: 0.3,
  },
  badgePropia: { backgroundColor: C.successSoft, color: C.success },
  badgeDerivar: { backgroundColor: C.warningSoft, color: C.warning },
  badgeAuth: { backgroundColor: C.successSoft, color: C.success },
  badgePendiente: { backgroundColor: C.warningSoft, color: C.warning },
  badgeRechazada: { backgroundColor: C.dangerSoft, color: C.danger },
  footer: {
    position: 'absolute',
    bottom: 16,
    left: 36,
    right: 36,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    borderTopWidth: 2,
    borderTopColor: C.primary,
    paddingTop: 6,
  },
  footerSignBox: { alignItems: 'flex-start' },
  footerSignLine: {
    width: 140,
    borderBottomWidth: 0.5,
    borderBottomColor: C.border,
    marginTop: 32,
    marginBottom: 3,
  },
  footerLabel: { fontSize: 8, color: C.subtle },
  footerMeta: { textAlign: 'right', fontSize: 7.5, color: C.subtle },
});

const SEX_LABEL: Record<'F' | 'M' | 'X', string> = { F: 'Femenino', M: 'Masculino', X: 'Otro' };

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value || '—'}</Text>
    </View>
  );
}

export function FichaTemplate({ data }: { data: FichaData }) {
  const sexLabel = data.patient.sex ? SEX_LABEL[data.patient.sex] : '—';

  return (
    <Document
      title={`Ficha ${data.protocol.number}`}
      author={data.lab.legalName}
      subject="Ficha de trabajo"
    >
      <Page size="A4" style={styles.page}>
        {/* ── Header ── */}
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
          <View style={styles.protocolBadge}>
            <Text style={styles.protocolLabel}>FICHA DE TRABAJO</Text>
            <Text style={styles.protocolNumber}>{data.protocol.number}</Text>
            <Text style={styles.protocolDate}>{data.protocol.orderDate}</Text>
            {data.protocol.isUrgent && <Text style={styles.urgentBadge}>● URGENTE</Text>}
          </View>
        </View>

        {/* ── Gold rule ── */}
        <View style={styles.rule} />
        <View style={{ marginBottom: 14 }} />

        {/* ── Info cards ── */}
        <View style={styles.infoGrid}>
          <View style={styles.infoCard}>
            <Text style={styles.cardTitle}>PACIENTE</Text>
            <InfoRow label="Apellido, Nombre" value={data.patient.fullName} />
            <InfoRow label="DNI" value={data.patient.dni} />
            <InfoRow label="Sexo · Edad" value={`${sexLabel} · ${data.patient.age}`} />
            <InfoRow label="Nacimiento" value={data.patient.birthDate} />
          </View>
          <View style={styles.infoCard}>
            <Text style={styles.cardTitle}>COBERTURA Y MÉDICO</Text>
            <InfoRow
              label="Obra social"
              value={
                data.insurer.name +
                (data.insurer.affiliateNumber ? ` · ${data.insurer.affiliateNumber}` : '')
              }
            />
            <InfoRow
              label="Médico"
              value={
                [data.doctor.name, data.doctor.mp ? `M.P. ${data.doctor.mp}` : null]
                  .filter(Boolean)
                  .join(' · ') || '—'
              }
            />
            {data.doctor.diagnosis ? (
              <InfoRow label="Diagnóstico" value={data.doctor.diagnosis} />
            ) : null}
            {data.doctor.notes ? <InfoRow label="Notas" value={data.doctor.notes} /> : null}
          </View>
        </View>

        {/* ── Practices table ── */}
        <Text style={styles.practicesTitle}>PRÁCTICAS A REALIZAR</Text>
        <View style={styles.table}>
          <View style={styles.tableHeader} fixed>
            <Text style={[styles.th, styles.colPractica]}>PRÁCTICA</Text>
            <Text style={[styles.th, styles.colNbu]}>NBU</Text>
            <Text style={[styles.th, styles.colSeccion]}>SECCIÓN</Text>
            <Text style={[styles.th, styles.colElab]}>ELABORACIÓN</Text>
            <Text style={[styles.th, styles.colAuth]}>AUTORIZACIÓN</Text>
          </View>
          {data.practices.map((p, idx) => (
            <View
              key={p.nbuCode}
              style={idx % 2 === 1 ? [styles.tableRow, styles.zebraRow] : styles.tableRow}
              wrap={false}
            >
              <View style={styles.colPractica}>
                <Text style={styles.practicaName}>{p.name}</Text>
                <Text style={styles.nbuText}>NBU {p.nbuCode}</Text>
              </View>
              <View style={styles.colNbu}>
                <Text style={styles.nbuText}>{p.nbuCode}</Text>
              </View>
              <View style={styles.colSeccion}>
                <Text style={styles.sectionText}>{p.section ?? '—'}</Text>
              </View>
              <View style={styles.colElab}>
                <Text
                  style={[styles.badge, p.isElaborated ? styles.badgePropia : styles.badgeDerivar]}
                >
                  {p.isElaborated ? 'PROPIA' : 'DERIVAR'}
                </Text>
              </View>
              <View style={styles.colAuth}>
                {p.authorizationStatus === 'autorizada' ? (
                  <Text style={[styles.badge, styles.badgeAuth]}>AUTORIZADA</Text>
                ) : p.authorizationStatus === 'pendiente' ? (
                  <Text style={[styles.badge, styles.badgePendiente]}>PENDIENTE</Text>
                ) : p.authorizationStatus === 'rechazada' ? (
                  <Text style={[styles.badge, styles.badgeRechazada]}>RECHAZADA</Text>
                ) : null}
              </View>
            </View>
          ))}
        </View>

        {/* ── Footer ── */}
        <View style={styles.footer} fixed>
          <View style={styles.footerSignBox}>
            <View style={styles.footerSignLine} />
            <Text style={styles.footerLabel}>Firma y aclaración · Bioquímico responsable</Text>
          </View>
          <View style={styles.footerSignBox}>
            <View style={styles.footerSignLine} />
            <Text style={styles.footerLabel}>Fecha y hora de extracción</Text>
          </View>
          <View>
            <Text style={styles.footerMeta}>Ficha de trabajo</Text>
            <Text style={styles.footerMeta}>Impreso: {data.printedAt}</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}
