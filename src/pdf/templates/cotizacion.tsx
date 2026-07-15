import { Document, Image, Page, StyleSheet, Text, View } from '@react-pdf/renderer';

const AR_MONEY = new Intl.NumberFormat('es-AR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
  useGrouping: true,
});
const AR_NUM = new Intl.NumberFormat('es-AR', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
  useGrouping: true,
});

function fmtMoney(s: string): string {
  const n = Number(s.replace(',', '.').trim());
  return Number.isNaN(n) ? s : `$ ${AR_MONEY.format(n)}`;
}
function fmtNum(s: string | null | undefined): string {
  if (!s) return '—';
  const n = Number(s);
  return Number.isNaN(n) ? s : AR_NUM.format(n);
}

export interface CotizacionPdfItem {
  practicaNombre: string;
  ubsSnapshot: string | null;
  ubValueSnapshot: string | null;
  precioUnitario: string;
  cantidad: number;
  subtotal: string;
}

export interface CotizacionPdfData {
  cotizacionId: number;
  fechaEmision: string;
  validezDias: number;
  estado: string;
  tipo: 'paciente' | 'empresa';
  receptorNombre: string;
  receptorDni?: string | null;
  receptorCuit?: string | null;
  receptorEmail?: string | null;
  receptorTelefono?: string | null;
  receptorContacto?: string | null;
  obraSocialNombre?: string | null;
  /** % copago a cargo del paciente, ej: "20.00" = 20%. NULL = OS cubre 100%. */
  copagoPorc?: string | null;
  totalCopago?: string | null;
  totalOs?: string | null;
  items: CotizacionPdfItem[];
  totalMonto: string;
  observaciones?: string | null;
  lab: {
    legalName: string;
    address: string;
    cityProvince: string;
    phone: string | null;
    email: string | null;
    logoSrc: string | null;
  };
  accent: string;
  accentSoft: string;
}

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Roboto',
    fontSize: 9,
    color: '#111',
    paddingTop: 48,
    paddingBottom: 48,
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
  cotBadge: {
    padding: 8,
    borderRadius: 4,
    alignItems: 'flex-end',
    minWidth: 110,
  },
  cotLabel: { fontSize: 7, fontWeight: 'bold', letterSpacing: 0.5, marginBottom: 1 },
  cotNumber: { fontSize: 14, fontWeight: 'bold' },
  cotDate: { fontSize: 7, color: '#666', marginTop: 2 },
  rule: { height: 2, marginBottom: 12 },
  infoGrid: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  infoCard: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 4,
    padding: 8,
  },
  cardTitle: { fontSize: 7, fontWeight: 'bold', letterSpacing: 0.5, marginBottom: 5 },
  infoRow: { flexDirection: 'row', marginBottom: 3 },
  infoLabel: { fontSize: 7.5, color: '#666', width: 80 },
  infoValue: { fontSize: 7.5, flex: 1, fontWeight: 'bold' },
  tableTitle: { fontSize: 9, fontWeight: 'bold', marginBottom: 6 },
  table: { borderWidth: 1, borderRadius: 4, overflow: 'hidden' },
  tableHeader: { flexDirection: 'row', paddingVertical: 5, paddingHorizontal: 8 },
  thPractica: { flex: 1, fontSize: 7.5, fontWeight: 'bold', color: '#fff' },
  thUbs: { width: 36, fontSize: 7.5, fontWeight: 'bold', color: '#fff', textAlign: 'center' },
  thUbVal: { width: 60, fontSize: 7.5, fontWeight: 'bold', color: '#fff', textAlign: 'right' },
  thQty: { width: 28, fontSize: 7.5, fontWeight: 'bold', color: '#fff', textAlign: 'center' },
  thPrecio: { width: 68, fontSize: 7.5, fontWeight: 'bold', color: '#fff', textAlign: 'right' },
  thSubtotal: { width: 72, fontSize: 7.5, fontWeight: 'bold', color: '#fff', textAlign: 'right' },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  tdPractica: { flex: 1, fontSize: 8 },
  tdUbs: { width: 36, fontSize: 8, textAlign: 'center', color: '#555' },
  tdUbVal: { width: 60, fontSize: 8, textAlign: 'right', color: '#555' },
  tdQty: { width: 28, fontSize: 8, textAlign: 'center', color: '#555' },
  tdPrecio: { width: 68, fontSize: 8, textAlign: 'right', color: '#555' },
  tdSubtotal: { width: 72, fontSize: 8, textAlign: 'right', fontWeight: 'bold' },
  // Totals block
  totalsBlock: {
    marginTop: 6,
    alignItems: 'flex-end',
  },
  totalLine: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 2,
  },
  totalLineLabel: { fontSize: 8, color: '#555', width: 140, textAlign: 'right', marginRight: 12 },
  totalLineValue: { fontSize: 8, color: '#555', width: 72, textAlign: 'right' },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 4,
    paddingTop: 5,
    borderTopWidth: 1.5,
  },
  totalLabel: { fontSize: 10, fontWeight: 'bold', marginRight: 12, width: 140, textAlign: 'right' },
  totalValue: { fontSize: 10, fontWeight: 'bold', width: 72, textAlign: 'right' },
  validez: { fontSize: 7.5, color: '#666', marginTop: 10 },
  obs: { fontSize: 7.5, color: '#444', marginTop: 6 },
  obsLabel: { fontWeight: 'bold' },
});

const hasUbInfo = (items: CotizacionPdfItem[]) =>
  items.some((i) => i.ubsSnapshot != null || i.ubValueSnapshot != null);

export function CotizacionTemplate({ data }: { data: CotizacionPdfData }) {
  const { accent, accentSoft } = data;
  const cardBorder = accentSoft;
  const cardBg = '#fafafa';
  const showUb = hasUbInfo(data.items);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* ── Header ── */}
        <View style={styles.header}>
          <View style={{ flexDirection: 'row', flex: 1, alignItems: 'flex-start' }}>
            {data.lab.logoSrc ? (
              <Image src={data.lab.logoSrc} style={styles.logo} />
            ) : null}
            <View style={styles.labInfo}>
              <Text style={styles.legalName}>{data.lab.legalName}</Text>
              <Text style={styles.labLine}>{data.lab.address}</Text>
              <Text style={styles.labLine}>{data.lab.cityProvince}</Text>
              {data.lab.phone ? <Text style={styles.labLine}>Tel: {data.lab.phone}</Text> : null}
              {data.lab.email ? <Text style={styles.labLine}>{data.lab.email}</Text> : null}
            </View>
          </View>
          <View style={[styles.cotBadge, { backgroundColor: accentSoft }]}>
            <Text style={[styles.cotLabel, { color: accent }]}>COTIZACIÓN</Text>
            <Text style={[styles.cotNumber, { color: accent }]}>
              #{String(data.cotizacionId).padStart(4, '0')}
            </Text>
            <Text style={styles.cotDate}>{data.fechaEmision}</Text>
          </View>
        </View>

        <View style={[styles.rule, { backgroundColor: accent }]} />

        {/* ── Info grid ── */}
        <View style={styles.infoGrid}>
          <View style={[styles.infoCard, { borderColor: cardBorder, backgroundColor: cardBg }]}>
            <Text style={[styles.cardTitle, { color: accent }]}>
              {data.tipo === 'empresa' ? 'EMPRESA' : 'PACIENTE'}
            </Text>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Nombre</Text>
              <Text style={styles.infoValue}>{data.receptorNombre}</Text>
            </View>
            {data.receptorDni ? (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>DNI</Text>
                <Text style={styles.infoValue}>{data.receptorDni}</Text>
              </View>
            ) : null}
            {data.receptorCuit ? (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>CUIT</Text>
                <Text style={styles.infoValue}>{data.receptorCuit}</Text>
              </View>
            ) : null}
            {data.receptorContacto ? (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Contacto</Text>
                <Text style={styles.infoValue}>{data.receptorContacto}</Text>
              </View>
            ) : null}
            {data.receptorEmail ? (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Email</Text>
                <Text style={styles.infoValue}>{data.receptorEmail}</Text>
              </View>
            ) : null}
            {data.receptorTelefono ? (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Teléfono</Text>
                <Text style={styles.infoValue}>{data.receptorTelefono}</Text>
              </View>
            ) : null}
          </View>

          <View style={[styles.infoCard, { borderColor: cardBorder, backgroundColor: cardBg, maxWidth: 170 }]}>
            <Text style={[styles.cardTitle, { color: accent }]}>CONDICIONES</Text>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Obra social</Text>
              <Text style={styles.infoValue}>{data.obraSocialNombre ?? 'Particular'}</Text>
            </View>
            {data.copagoPorc ? (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Copago paciente</Text>
                <Text style={styles.infoValue}>{fmtNum(data.copagoPorc)}%</Text>
              </View>
            ) : null}
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Validez</Text>
              <Text style={styles.infoValue}>{data.validezDias} días</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Estado</Text>
              <Text style={styles.infoValue}>{data.estado}</Text>
            </View>
          </View>
        </View>

        {/* ── Items table ── */}
        <Text style={[styles.tableTitle, { color: accent }]}>Prácticas cotizadas</Text>
        <View style={styles.table}>
          <View style={[styles.tableHeader, { backgroundColor: accent }]}>
            <Text style={styles.thPractica}>Práctica</Text>
            {showUb ? <Text style={styles.thUbs}>UBs</Text> : null}
            {showUb ? <Text style={styles.thUbVal}>Valor UB</Text> : null}
            <Text style={styles.thQty}>Cant.</Text>
            <Text style={styles.thPrecio}>Precio unit.</Text>
            <Text style={styles.thSubtotal}>Subtotal</Text>
          </View>
          {data.items.map((item, idx) => (
            <View
              key={idx}
              style={[styles.tableRow, { backgroundColor: idx % 2 === 0 ? '#fff' : '#f9fafb' }]}
            >
              <Text style={styles.tdPractica}>{item.practicaNombre}</Text>
              {showUb ? <Text style={styles.tdUbs}>{fmtNum(item.ubsSnapshot)}</Text> : null}
              {showUb ? (
                <Text style={styles.tdUbVal}>
                  {item.ubValueSnapshot ? fmtMoney(item.ubValueSnapshot) : '—'}
                </Text>
              ) : null}
              <Text style={styles.tdQty}>{item.cantidad}</Text>
              <Text style={styles.tdPrecio}>{fmtMoney(item.precioUnitario)}</Text>
              <Text style={styles.tdSubtotal}>{fmtMoney(item.subtotal)}</Text>
            </View>
          ))}
        </View>

        {/* ── Totals ── */}
        <View style={styles.totalsBlock}>
          {data.copagoPorc && data.totalOs && data.totalCopago ? (
            <>
              <View style={styles.totalLine}>
                <Text style={styles.totalLineLabel}>
                  Cubre obra social ({(100 - Number(data.copagoPorc)).toFixed(0)}%)
                </Text>
                <Text style={styles.totalLineValue}>{fmtMoney(data.totalOs)}</Text>
              </View>
              <View style={styles.totalLine}>
                <Text style={styles.totalLineLabel}>
                  Copago paciente ({fmtNum(data.copagoPorc)}%)
                </Text>
                <Text style={styles.totalLineValue}>{fmtMoney(data.totalCopago)}</Text>
              </View>
            </>
          ) : null}
          <View style={[styles.totalRow, { borderTopColor: accent }]}>
            <Text style={styles.totalLabel}>TOTAL</Text>
            <Text style={[styles.totalValue, { color: accent }]}>{fmtMoney(data.totalMonto)}</Text>
          </View>
        </View>

        {/* ── Pie ── */}
        <Text style={styles.validez}>
          Esta cotización tiene validez de {data.validezDias} días desde la fecha de emisión.
        </Text>
        {data.observaciones ? (
          <Text style={styles.obs}>
            <Text style={styles.obsLabel}>Observaciones: </Text>
            {data.observaciones}
          </Text>
        ) : null}
      </Page>
    </Document>
  );
}
