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
  /** Valor UB vigente de la obra social (ARS por UB). */
  valorUb: string | null;
  /** Fecha de vigencia del valor UB. */
  valorUbDesde: string | null;
  items: Array<{
    practicaNombre: string;
    /** Código NABA / nomenclador si está cargado. */
    codigoNbu: string | null;
    /** Cantidad de UBs de la práctica según el nomenclador. */
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
    paddingTop: 44,
    paddingBottom: 44,
    paddingLeft: 44,
    paddingRight: 44,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  logo: { width: 72, height: 36, objectFit: 'contain' },
  labInfo: { flex: 1, paddingLeft: 8 },
  legalName: { fontSize: 11, fontWeight: 'bold', marginBottom: 2 },
  labLine: { fontSize: 7.5, color: '#555' },
  badge: { padding: 8, borderRadius: 4, alignItems: 'flex-end', minWidth: 110 },
  badgeLabel: { fontSize: 7, fontWeight: 'bold', letterSpacing: 0.5, marginBottom: 1 },
  badgeDate: { fontSize: 7, color: '#666', marginTop: 2 },
  rule: { height: 2, marginBottom: 14 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 3, marginTop: 12 },
  sectionTitle: { fontSize: 9, fontWeight: 'bold', flex: 1 },
  sectionUb: { fontSize: 8, color: '#444' },
  table: { borderWidth: 1, borderRadius: 4, overflow: 'hidden' },
  tableHeader: { flexDirection: 'row', paddingVertical: 4, paddingHorizontal: 8 },
  thCodigo: { width: 48, fontSize: 7, fontWeight: 'bold', color: '#fff' },
  thPractica: { flex: 1, fontSize: 7.5, fontWeight: 'bold', color: '#fff' },
  thUbs: { width: 36, fontSize: 7.5, fontWeight: 'bold', color: '#fff', textAlign: 'center' },
  thPrecio: { width: 72, fontSize: 7.5, fontWeight: 'bold', color: '#fff', textAlign: 'right' },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  tdCodigo: { width: 48, fontSize: 7, color: '#888', fontFamily: 'Roboto' },
  tdPractica: { flex: 1, fontSize: 8 },
  tdUbs: { width: 36, fontSize: 8, textAlign: 'center', color: '#555' },
  tdPrecio: { width: 72, fontSize: 8, textAlign: 'right', fontWeight: 'bold' },
  footer: { position: 'absolute', bottom: 28, left: 44, right: 44 },
  footerText: { fontSize: 7, color: '#aaa', textAlign: 'center' },
});

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
            <Text style={[styles.badgeDate, { color: '#666' }]}>{data.fecha}</Text>
          </View>
        </View>

        <View style={[styles.rule, { backgroundColor: accent }]} />

        {/* ── Sections por Obra Social ── */}
        {data.sections.map((section, si) => (
          <View key={si} wrap={false}>
            <View style={styles.sectionHeader}>
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: accent, marginRight: 6 }} />
              <Text style={[styles.sectionTitle, { color: accent }]}>{section.insurerName}</Text>
              {section.valorUb && (
                <Text style={styles.sectionUb}>
                  {'  Valor UB: '}
                  {fmtMoney(section.valorUb)}
                  {section.valorUbDesde ? `  (desde ${section.valorUbDesde})` : ''}
                </Text>
              )}
            </View>
            <View style={[styles.table, { borderColor: accentSoft }]}>
              <View style={[styles.tableHeader, { backgroundColor: accent }]}>
                <Text style={styles.thCodigo}>Código</Text>
                <Text style={styles.thPractica}>Práctica</Text>
                <Text style={styles.thUbs}>UBs</Text>
                <Text style={styles.thPrecio}>Precio</Text>
              </View>
              {section.items.map((item, ii) => (
                <View
                  key={ii}
                  style={[styles.tableRow, { backgroundColor: ii % 2 === 0 ? '#fff' : '#f9fafb' }]}
                >
                  <Text style={styles.tdCodigo}>{item.codigoNbu ?? ''}</Text>
                  <Text style={styles.tdPractica}>{item.practicaNombre}</Text>
                  <Text style={styles.tdUbs}>{fmtNum(item.ubs)}</Text>
                  <Text style={styles.tdPrecio}>{fmtMoney(item.precio)}</Text>
                </View>
              ))}
            </View>
          </View>
        ))}

        {/* ── Footer ── */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>
            Aranceles calculados por nomenclador · Valor UB vigente a la fecha de emisión · {data.lab.legalName}
          </Text>
        </View>
      </Page>
    </Document>
  );
}
