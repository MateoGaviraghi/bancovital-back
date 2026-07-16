import { Document, Image, Page, StyleSheet, Text, View } from '@react-pdf/renderer';

const AR_MONEY = new Intl.NumberFormat('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: true });
const AR_NUM = new Intl.NumberFormat('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

function fmtMoney(s: string | null | undefined): string {
  if (!s) return '—';
  const n = Number(s.replace(',', '.').trim());
  return Number.isNaN(n) ? s : `$ ${AR_MONEY.format(n)}`;
}
function fmtNum(s: string | null | undefined): string {
  if (!s) return '—';
  const n = Number(s);
  return Number.isNaN(n) ? s : AR_NUM.format(n);
}

// ── Interfaces ─────────────────────────────────────────────────────────────────

export interface CatalogoPrecioColumn {
  name: string;
  /** Valor de la UB vigente (ARS), null para Particular. */
  valorUb: string | null;
  valorUbDesde: string | null;
}

export interface CatalogoPrecioRow {
  practicaNombre: string;
  codigoNbu: string | null;
  ubs: string | null;
  /** Precio por columna (mismo índice que CatalogoPdfData.columns), null = sin precio. */
  prices: Array<string | null>;
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
  /** Columnas de precio (Particular primero si existe, luego OSs). */
  columns: CatalogoPrecioColumn[];
  /** Filas de prácticas (sólo las que tienen al menos un precio). */
  rows: CatalogoPrecioRow[];
  accent: string;
  accentSoft: string;
}

// ── Layout math ────────────────────────────────────────────────────────────────

// A4 landscape: 842 × 595 pt. Margins 36 c/u → usable = 770pt.
const USABLE_W = 770;
const CODE_W = 44;
const UBS_W = 36;

function priceColWidth(numCols: number): number {
  if (numCols <= 3) return 88;
  if (numCols <= 5) return 76;
  if (numCols <= 7) return 66;
  if (numCols <= 9) return 58;
  return 52;
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Roboto',
    fontSize: 8,
    color: '#111',
    paddingTop: 36,
    paddingBottom: 36,
    paddingLeft: 36,
    paddingRight: 36,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  logo: { width: 60, height: 30, objectFit: 'contain' },
  labInfo: { flex: 1, paddingLeft: 6 },
  legalName: { fontSize: 11, fontWeight: 'bold', marginBottom: 1 },
  labLine: { fontSize: 7.5, color: '#555' },
  badge: { padding: 6, borderRadius: 4, alignItems: 'flex-end', minWidth: 100 },
  badgeLabel: { fontSize: 7.5, fontWeight: 'bold', letterSpacing: 0.5, marginBottom: 1 },
  badgeDate: { fontSize: 7.5, color: '#666' },
  rule: { height: 2, marginBottom: 10 },
  /* Table */
  tableHeader: {
    flexDirection: 'row',
    paddingVertical: 5,
    paddingHorizontal: 4,
    borderRadius: 3,
    marginBottom: 1,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 4,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  thCode: { width: CODE_W, fontSize: 7, fontWeight: 'bold', color: '#fff' },
  thName: { flex: 1, fontSize: 7.5, fontWeight: 'bold', color: '#fff' },
  thUbs: { width: UBS_W, fontSize: 7.5, fontWeight: 'bold', color: '#fff', textAlign: 'center' },
  thPrice: { fontSize: 7.5, fontWeight: 'bold', color: '#fff', textAlign: 'right' },
  tdCode: { width: CODE_W, fontSize: 7, color: '#888' },
  tdName: { flex: 1, fontSize: 8 },
  tdUbs: { width: UBS_W, fontSize: 7.5, textAlign: 'center', color: '#555' },
  tdPrice: { fontSize: 7.5, textAlign: 'right', color: '#111' },
  tdPriceMissing: { fontSize: 7.5, textAlign: 'right', color: '#bbb' },
  /* Sub-header: UB values per insurer */
  ubRow: {
    flexDirection: 'row',
    paddingBottom: 6,
    paddingHorizontal: 4,
  },
  ubCell: { fontSize: 6.5, color: '#666', textAlign: 'right' },
  footer: { position: 'absolute', bottom: 18, left: 36, right: 36 },
  footerText: { fontSize: 6.5, color: '#aaa', textAlign: 'center' },
});

// ── Template ───────────────────────────────────────────────────────────────────

export function CatalogoTemplate({ data }: { data: CatalogoPdfData }) {
  const { accent, accentSoft } = data;
  const { columns, rows } = data;

  const numCols = columns.length;
  const pColW = priceColWidth(numCols);

  const showCode = rows.some((r) => r.codigoNbu);
  const showUbs = rows.some((r) => r.ubs);

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
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

        {/* ── Column header row ── */}
        <View style={[styles.tableHeader, { backgroundColor: accent }]} wrap={false}>
          {showCode ? <Text style={styles.thCode}>Código</Text> : null}
          <Text style={styles.thName}>Práctica</Text>
          {showUbs ? <Text style={styles.thUbs}>UBs</Text> : null}
          {columns.map((col, ci) => (
            <Text key={ci} style={[styles.thPrice, { width: pColW }]}>
              {col.name}
            </Text>
          ))}
        </View>

        {/* ── UB value sub-header (valor UB por OS) ── */}
        {columns.some((c) => c.valorUb) ? (
          <View style={[styles.ubRow, { backgroundColor: accentSoft }]} wrap={false}>
            {showCode ? <View style={{ width: CODE_W }} /> : null}
            <View style={{ flex: 1 }} />
            {showUbs ? <View style={{ width: UBS_W }} /> : null}
            {columns.map((col, ci) => (
              <Text key={ci} style={[styles.ubCell, { width: pColW }]}>
                {col.valorUb ? `UB ${fmtMoney(col.valorUb)}` : ''}
              </Text>
            ))}
          </View>
        ) : null}

        {/* ── Practice rows ── */}
        {rows.map((row, ri) => (
          <View
            key={ri}
            style={[styles.tableRow, { backgroundColor: ri % 2 === 0 ? '#fff' : '#f9fafb' }]}
            wrap={false}
          >
            {showCode ? <Text style={styles.tdCode}>{row.codigoNbu ?? ''}</Text> : null}
            <Text style={styles.tdName}>{row.practicaNombre}</Text>
            {showUbs ? <Text style={styles.tdUbs}>{fmtNum(row.ubs)}</Text> : null}
            {row.prices.map((price, ci) =>
              price != null ? (
                <Text key={ci} style={[styles.tdPrice, { width: pColW }]}>
                  {fmtMoney(price)}
                </Text>
              ) : (
                <Text key={ci} style={[styles.tdPriceMissing, { width: pColW }]}>
                  —
                </Text>
              ),
            )}
          </View>
        ))}

        {/* ── Footer ── */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>
            {data.lab.legalName} · Aranceles a la fecha de emisión · {data.fecha}
          </Text>
        </View>
      </Page>
    </Document>
  );
}
