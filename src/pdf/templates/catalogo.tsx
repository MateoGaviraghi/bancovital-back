import { Document, Image, Page, StyleSheet, Text, View } from '@react-pdf/renderer';

const AR_MONEY = new Intl.NumberFormat('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: true });
const AR_NUM = new Intl.NumberFormat('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

function fmtMoney(s: string): string {
  const n = Number(s.replace(',', '.').trim());
  return Number.isNaN(n) ? s : `$ ${AR_MONEY.format(n)}`;
}
function fmtNum(s: string | null | undefined): string {
  if (!s) return '—';
  const n = Number(s);
  return Number.isNaN(n) ? s : AR_NUM.format(n);
}

export interface CatalogoPrecioSection {
  insurerName: string;
  valorUb: string | null;
  valorUbDesde: string | null;
  items: Array<{
    practicaNombre: string;
    codigoNbu: string | null;
    ubs: string | null;
    precio: string;
  }>;
}

export interface CatalogoPdfData {
  fecha: string;
  lab: {
    legalName: string;
    address: string;
    cityProvince: string;
    phone: string | null;
    email: string | null;
    logoSrc: string | null;
  };
  sections: CatalogoPrecioSection[];
  accent: string;
  accentSoft: string;
}

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Roboto',
    fontSize: 9,
    color: '#111',
    paddingTop: 40,
    paddingBottom: 44,
    paddingLeft: 40,
    paddingRight: 40,
  },
  /* ── Header (aparece en la primera página) ── */
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  logo: { width: 72, height: 36, objectFit: 'contain' },
  labInfo: { flex: 1, paddingLeft: 8 },
  legalName: { fontSize: 12, fontWeight: 'bold', marginBottom: 2 },
  labLine: { fontSize: 8, color: '#555' },
  badge: { padding: 8, borderRadius: 4, alignItems: 'flex-end', minWidth: 120 },
  badgeLabel: { fontSize: 8, fontWeight: 'bold', letterSpacing: 0.5, marginBottom: 1 },
  badgeDate: { fontSize: 8, color: '#666', marginTop: 2 },
  rule: { height: 2, marginBottom: 16 },
  /* ── Section ── */
  sectionBlock: { marginBottom: 18 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 5,
    paddingBottom: 4,
    borderBottomWidth: 1.5,
  },
  dot: { width: 7, height: 7, borderRadius: 4, marginRight: 7 },
  sectionTitle: { fontSize: 10, fontWeight: 'bold', flex: 1 },
  sectionUb: { fontSize: 8, color: '#444' },
  /* ── Table ── */
  tableHeaderRow: {
    flexDirection: 'row',
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 3,
    marginBottom: 1,
  },
  thCodigo: { width: 52, fontSize: 7.5, fontWeight: 'bold', color: '#fff' },
  thPractica: { flex: 1, fontSize: 8, fontWeight: 'bold', color: '#fff' },
  thUbs: { width: 38, fontSize: 8, fontWeight: 'bold', color: '#fff', textAlign: 'center' },
  thPrecio: { width: 76, fontSize: 8, fontWeight: 'bold', color: '#fff', textAlign: 'right' },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  tdCodigo: { width: 52, fontSize: 7.5, color: '#888' },
  tdPractica: { flex: 1, fontSize: 8.5, color: '#111' },
  tdUbs: { width: 38, fontSize: 8.5, textAlign: 'center', color: '#555' },
  tdPrecio: { width: 76, fontSize: 8.5, textAlign: 'right', fontWeight: 'bold', color: '#111' },
  /* ── Footer ── */
  footer: { position: 'absolute', bottom: 20, left: 40, right: 40, flexDirection: 'row', justifyContent: 'space-between' },
  footerText: { fontSize: 7, color: '#aaa' },
});

function SectionBlock({
  section,
  accent,
  accentSoft,
}: {
  section: CatalogoPrecioSection;
  accent: string;
  accentSoft: string;
}) {
  return (
    <View style={styles.sectionBlock}>
      {/* Section header — mantener junto con la primera fila */}
      <View style={[styles.sectionHeader, { borderBottomColor: accentSoft }]} wrap={false}>
        <View style={[styles.dot, { backgroundColor: accent }]} />
        <Text style={[styles.sectionTitle, { color: accent }]}>{section.insurerName}</Text>
        {section.valorUb ? (
          <Text style={styles.sectionUb}>
            Valor UB: {fmtMoney(section.valorUb)}
            {section.valorUbDesde ? `  (desde ${section.valorUbDesde})` : ''}
          </Text>
        ) : null}
      </View>

      {/* Table header */}
      <View style={[styles.tableHeaderRow, { backgroundColor: accent }]} wrap={false}>
        <Text style={styles.thCodigo}>Código</Text>
        <Text style={styles.thPractica}>Práctica</Text>
        <Text style={styles.thUbs}>UBs</Text>
        <Text style={styles.thPrecio}>Precio</Text>
      </View>

      {/* Rows: fluyen libremente entre páginas */}
      {section.items.map((item, ii) => (
        <View
          key={ii}
          style={[styles.tableRow, { backgroundColor: ii % 2 === 0 ? '#fff' : '#f9fafb' }]}
          wrap={false}
        >
          <Text style={styles.tdCodigo}>{item.codigoNbu ?? ''}</Text>
          <Text style={styles.tdPractica}>{item.practicaNombre}</Text>
          <Text style={styles.tdUbs}>{fmtNum(item.ubs)}</Text>
          <Text style={styles.tdPrecio}>{fmtMoney(item.precio)}</Text>
        </View>
      ))}
    </View>
  );
}

export function CatalogoTemplate({ data }: { data: CatalogoPdfData }) {
  const { accent, accentSoft } = data;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* ── Header ── */}
        <View style={styles.header}>
          <View style={{ flexDirection: 'row', flex: 1, alignItems: 'flex-start' }}>
            {data.lab.logoSrc ? <Image src={data.lab.logoSrc} style={styles.logo} /> : null}
            <View style={styles.labInfo}>
              <Text style={styles.legalName}>{data.lab.legalName}</Text>
              <Text style={styles.labLine}>{data.lab.address}</Text>
              <Text style={styles.labLine}>{data.lab.cityProvince}</Text>
              {data.lab.phone ? <Text style={styles.labLine}>Tel: {data.lab.phone}</Text> : null}
              {data.lab.email ? <Text style={styles.labLine}>{data.lab.email}</Text> : null}
            </View>
          </View>
          <View style={[styles.badge, { backgroundColor: accentSoft }]}>
            <Text style={[styles.badgeLabel, { color: accent }]}>ARANCELES</Text>
            <Text style={styles.badgeDate}>{data.fecha}</Text>
          </View>
        </View>

        <View style={[styles.rule, { backgroundColor: accent }]} />

        {/* ── Secciones ── */}
        {data.sections.map((section, si) => (
          <SectionBlock key={si} section={section} accent={accent} accentSoft={accentSoft} />
        ))}

        {/* ── Footer fijo en cada página ── */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>
            {data.lab.legalName} · Aranceles a la fecha de emisión · {data.fecha}
          </Text>
        </View>
      </Page>
    </Document>
  );
}
