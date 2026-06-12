# 09 — Generación de informes PDF

Stack: `@react-pdf/renderer` (server-side, JSX → PDF Buffer).

## Estructura

```
src/pdf/
├── render.tsx              # Función principal renderInformePdf
└── templates/
    └── informe.tsx         # Template del informe (JSX)
```

## `render.tsx`

```typescript
import { renderToBuffer } from '@react-pdf/renderer';
import type { Db } from '@/db/client';
import { db } from '@/db/client';
import { eq } from 'drizzle-orm';
import { labConfig } from '@/db/schema/lab-config';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { InformeTemplate, type InformeData } from './templates/informe';

export type RenderInformeInput = {
  order: {
    id: number;
    protocolNumber: number;
    orderDate: Date;
    diagnosis: string | null;
    insuranceAffiliateNumber: string | null;
    referringDoctorName: string | null;
    referringDoctorMp: string | null;
    pdfReportIssuedAt?: Date | null;
  };
  patient: {
    firstName: string;
    lastName: string;
    dni: string;
    sex: 'F' | 'M' | 'X' | null;
    birthDate: Date;
  };
  insurer: { name: string };
  lines: Array<{
    id: number;
    practiceId: number | null;
    nbuCodeSnapshot: string;
    nameSnapshot: string;
    includeInReport: boolean;
  }>;
  results: Array<{
    result: {
      valueNumeric: string | null;
      valueText: string | null;
      unit: string | null;
      referenceRangeLow: string | null;
      referenceRangeHigh: string | null;
      flag: string | null;
      methodology: string | null;
      notes: string | null;
    } | null;
    line: { id: number };
  }>;
  signedBy: {
    name: string;
    role: 'admin' | 'recepcion' | 'bioquimico';
  };
};

export async function renderInformePdf(input: RenderInformeInput): Promise<Buffer> {
  const [lab] = await db.select().from(labConfig).limit(1);
  if (!lab) throw new Error('lab_config row not found.');

  const logoSrc = lab.logoUrl || loadBundledLogo();
  const resultsByLineId = new Map(input.results.map((r) => [r.line.id, r.result]));

  const data: InformeData = {
    lab: {
      legalName: lab.legalName,
      cuit: lab.cuit,
      address: lab.streetAddress,
      cityProvince: `${lab.city}, ${lab.province}`,
      phone: lab.phone,
      email: lab.email,
      logoSrc,
    },
    protocol: {
      number: String(input.order.protocolNumber).padStart(8, '0'),
      orderDate: formatDate(input.order.orderDate),
      issuedAt: formatDateTime(input.order.pdfReportIssuedAt ?? new Date()),
    },
    patient: {
      fullName: `${input.patient.lastName}, ${input.patient.firstName}`,
      dni: input.patient.dni,
      sex: input.patient.sex,
      age: ageString(input.patient.birthDate),
      birthDate: formatDate(input.patient.birthDate),
    },
    insurer: { name: input.insurer.name, affiliateNumber: input.order.insuranceAffiliateNumber },
    doctor: {
      name: input.order.referringDoctorName,
      mp: input.order.referringDoctorMp,
      diagnosis: input.order.diagnosis,
    },
    results: input.lines
      .filter((l) => l.includeInReport && l.practiceId != null)
      .map((line) => {
        const r = resultsByLineId.get(line.id);
        const value = r?.valueNumeric != null ? r.valueNumeric.toString() : (r?.valueText ?? '');
        return {
          nbuCode: line.nbuCodeSnapshot,
          name: line.nameSnapshot,
          value,
          unit: r?.unit ?? null,
          range: r ? formatRange(r.referenceRangeLow, r.referenceRangeHigh, r.unit) : null,
          flag: r?.flag ?? null,
          methodology: r?.methodology ?? null,
          notes: r?.notes ?? null,
        };
      }),
    signedBy: {
      name: input.signedBy.name,
      matricula: lab.signingProfessionalMp
        ? (lab.signingProfessionalMp.startsWith('M.P.')
            ? lab.signingProfessionalMp
            : `M.P. ${lab.signingProfessionalMp}`)
        : null,
    },
  };

  return renderToBuffer(<InformeTemplate data={data} />);
}

function formatDate(d: Date): string {
  return d.toLocaleDateString('es-AR', { timeZone: 'America/Argentina/Cordoba' });
}

function formatDateTime(d: Date): string {
  return d.toLocaleString('es-AR', { timeZone: 'America/Argentina/Cordoba', hour12: false });
}

function ageString(birth: Date): string {
  const years = Math.floor((Date.now() - birth.getTime()) / (365.2425 * 24 * 60 * 60 * 1000));
  return `${years} años`;
}

function formatRange(low: string | null, high: string | null, unit: string | null): string | null {
  if (!low && !high) return null;
  const a = low ?? '−∞';
  const b = high ?? '+∞';
  return `${a} – ${b}${unit ? ` ${unit}` : ''}`;
}

function loadBundledLogo(): string | null {
  const candidates = [
    resolve(process.cwd(), 'public', 'lab-logo.jpg'),
  ];
  for (const p of candidates) {
    if (existsSync(p)) {
      const buf = readFileSync(p);
      return `data:image/jpeg;base64,${buf.toString('base64')}`;
    }
  }
  return null;
}
```

## Template `informe.tsx`

Estructura del PDF (~430 líneas en total):

```typescript
import { Document, Page, Text, View, Image, StyleSheet } from '@react-pdf/renderer';

export type InformeData = {
  lab: { legalName, cuit, address, cityProvince, phone, email, logoSrc };
  protocol: { number, orderDate, issuedAt };
  patient: { fullName, dni, sex, age, birthDate };
  insurer: { name, affiliateNumber };
  doctor: { name, mp, diagnosis };
  results: Array<{
    nbuCode, name, value, unit, range, flag, methodology, notes
  }>;
  signedBy: { name, matricula };
};

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 10 },
  header: { flexDirection: 'row', marginBottom: 16, paddingBottom: 12, borderBottom: '1pt solid #0f172a' },
  // ... ~30 estilos
});

export function InformeTemplate({ data }: { data: InformeData }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* HEADER: logo + lab info + protocol box */}
        <View style={styles.header}>
          {data.lab.logoSrc && <Image src={data.lab.logoSrc} style={styles.logo} />}
          <View style={styles.labInfo}>
            <Text style={styles.legalName}>{data.lab.legalName}</Text>
            <Text>{data.lab.address} — {data.lab.cityProvince}</Text>
            <Text>CUIT {data.lab.cuit}</Text>
          </View>
          <View style={styles.protocolBox}>
            <Text style={styles.protocolLabel}>PROTOCOLO</Text>
            <Text style={styles.protocolNumber}>{data.protocol.number}</Text>
            <Text>{data.protocol.orderDate}</Text>
          </View>
        </View>

        {/* SECCIÓN PACIENTE */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>PACIENTE</Text>
          <Row label="Apellido, Nombre" value={data.patient.fullName} />
          <Row label="DNI" value={data.patient.dni} />
          <Row label="Sexo · Edad" value={`${data.patient.sex ?? '—'} · ${data.patient.age}`} />
          <Row label="Fecha de nacimiento" value={data.patient.birthDate} />
        </View>

        {/* SECCIÓN COBERTURA + MÉDICO */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>COBERTURA Y MÉDICO SOLICITANTE</Text>
          <Row label="Obra social" value={`${data.insurer.name}${data.insurer.affiliateNumber ? ` · ${data.insurer.affiliateNumber}` : ''}`} />
          <Row label="Médico" value={`${data.doctor.name ?? '—'}${data.doctor.mp ? ` · M.P. ${data.doctor.mp}` : ''}`} />
          {data.doctor.diagnosis && <Row label="Diagnóstico presuntivo" value={data.doctor.diagnosis} />}
        </View>

        {/* TABLA DE RESULTADOS */}
        <View style={styles.results}>
          <Text style={styles.sectionTitle}>RESULTADOS</Text>
          <View style={styles.tableHeader}>
            <Text style={styles.colName}>PRÁCTICA</Text>
            <Text style={styles.colValue}>VALOR</Text>
            <Text style={styles.colUnit}>UNIDAD</Text>
            <Text style={styles.colRange}>REFERENCIA</Text>
            <Text style={styles.colFlag}>ESTADO</Text>
          </View>
          {data.results.map((r, i) => (
            <View key={i} style={styles.tableRow}>
              <View style={styles.colName}>
                <Text style={styles.practiceName}>{r.name}</Text>
                <Text style={styles.nbuCode}>NBU {r.nbuCode}</Text>
              </View>
              <Text style={styles.colValue}>{r.value}</Text>
              <Text style={styles.colUnit}>{r.unit ?? ''}</Text>
              <Text style={styles.colRange}>{r.range ?? ''}</Text>
              <Text style={[styles.colFlag, flagStyle(r.flag)]}>{flagLabel(r.flag)}</Text>
            </View>
          ))}
        </View>

        {/* FOOTER: firma profesional */}
        <View style={styles.footer}>
          <Text style={styles.signed}>{data.signedBy.name}</Text>
          {data.signedBy.matricula && <Text>{data.signedBy.matricula}</Text>}
          <Text style={styles.issuedAt}>Emitido: {data.protocol.issuedAt}</Text>
        </View>
      </Page>
    </Document>
  );
}

function flagLabel(flag: string | null): string {
  switch (flag) {
    case 'normal': return 'Normal';
    case 'low': return 'BAJO';
    case 'high': return 'ALTO';
    case 'critical_low': return 'CRÍTICO BAJO';
    case 'critical_high': return 'CRÍTICO ALTO';
    default: return '';
  }
}

function flagStyle(flag: string | null) {
  return {
    color: flag === 'normal' ? '#15803d' :
           flag?.startsWith('critical') ? '#b91c1c' :
           flag ? '#b45309' :
           '#475569',
    fontWeight: flag?.startsWith('critical') ? 'bold' : 'normal',
  };
}
```

## Upload a Supabase Storage

Bucket: `reports` (privado).

Path: `{orderId}/{protocolNumber-8-digits}.pdf`. Ej: `42/00000011.pdf`.

```typescript
// En ReportsService.emit(...)
const buffer = await renderInformePdf({ /* ... */ });
const path = `${order.id}/${String(order.protocolNumber).padStart(8, '0')}.pdf`;

const admin = getAdminClient();
const { error } = await admin.storage.from('reports').upload(path, buffer, {
  contentType: 'application/pdf',
  upsert: true,
});
if (error) throw new InternalServerErrorException(error.message);

await ordersService.markEmitted(order.id, path, user.userId);
```

## Signed URL

```typescript
const { data, error } = await admin.storage
  .from('reports')
  .createSignedUrl(path, ttlSeconds);
// data.signedUrl es la URL temporal
```

## Self-healing en signedUrl

Si el blob no existe en Storage (orden vieja, archivo borrado), regenerar:

```typescript
async signedUrl(orderId: number, ttl = 900, user: Session) {
  const order = await this.orders.byId(orderId);
  if (order.status !== 'emitida') throw new NotFoundException('Aún no emitido');

  const admin = getAdminClient();

  if (order.pdfReportPath) {
    const { data, error } = await admin.storage.from('reports')
      .createSignedUrl(order.pdfReportPath, ttl);
    if (data && !error) return { url: data.signedUrl, regenerated: false };
  }

  // Regenerar
  const path = await this.renderAndUpload(orderId, user);
  await this.orders.setPdfPath(orderId, path);
  const { data, error } = await admin.storage.from('reports').createSignedUrl(path, ttl);
  if (error || !data) throw new InternalServerErrorException();
  return { url: data.signedUrl, regenerated: true };
}
```

## Regenerate all (admin)

Para cuando se cambia `lab_config` y se quiere propagar a informes ya emitidos:

```typescript
async regenerateAll(user: Session) {
  const orders = await db.select({ id: order.id })
    .from(order)
    .where(eq(order.status, 'emitida'));

  let regenerated = 0;
  const failures: Array<{ orderId: number; error: string }> = [];

  for (const { id } of orders) {
    try {
      const path = await this.renderAndUpload(id, user);
      await this.orders.setPdfPath(id, path);
      regenerated++;
    } catch (err: any) {
      failures.push({ orderId: id, error: err.message });
    }
  }

  return { total: orders.length, regenerated, failures };
}
```
