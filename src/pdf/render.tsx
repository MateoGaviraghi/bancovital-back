import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type {
  Laboratorio,
  Order,
  OrderPractice,
  OrderPracticeUnidadValue,
  Patient,
  PreferenciaPdf,
  Result,
} from '@/db/schema';
import { Font, renderToBuffer } from '@react-pdf/renderer';
import { type FichaData, FichaTemplate } from './templates/ficha';
import { type InformeData, InformeTemplate, type InformeUnidadRow } from './templates/informe';

const FONTS_DIR = join(__dirname, 'fonts');
let fontsRegistered = false;
let logoFallbackDataUri: string | null = null;

function getLogoFallback(): string | null {
  if (logoFallbackDataUri !== null) return logoFallbackDataUri || null;
  try {
    const buf = readFileSync(join(__dirname, 'labo.jpeg'));
    logoFallbackDataUri = `data:image/jpeg;base64,${buf.toString('base64')}`;
  } catch {
    logoFallbackDataUri = '';
  }
  return logoFallbackDataUri || null;
}

function ensureFontsRegistered(): void {
  if (fontsRegistered) return;
  Font.register({
    family: 'Roboto',
    fonts: [
      { src: join(FONTS_DIR, 'Roboto-Regular.ttf'), fontWeight: 'normal' },
      { src: join(FONTS_DIR, 'Roboto-Bold.ttf'), fontWeight: 'bold' },
    ],
  });
  Font.registerHyphenationCallback((word) => [word]);
  fontsRegistered = true;
}

export interface RenderInformeInput {
  order: Order;
  patient: Patient;
  insurer: { name: string };
  lines: OrderPractice[];
  resultsByLineId: Map<number, Result>;
  /** Valores de unidades cargados, agrupados por orderPracticeId (sort ya aplicado). */
  unidadValuesByLineId?: Map<number, OrderPracticeUnidadValue[]>;
  /** Metodologia y valor de referencia por practiceId (para mostrar en PDF cuando no hay resultado). */
  practiceDataById?: Map<number, { methodology: string | null; referenceValue: string | null }>;
  lab: Laboratorio;
  logoDataUri?: string | null;
  signatureDataUri?: string | null;
  fondoDataUri?: string | null;
  preferenciaPdf?: PreferenciaPdf;
}

export async function renderInformePdf(input: RenderInformeInput): Promise<Buffer> {
  ensureFontsRegistered();
  const data = buildInformeData(input);
  return renderToBuffer(<InformeTemplate data={data} />);
}

export interface RenderFichaInput {
  order: Order;
  patient: Patient;
  insurer: { name: string };
  lines: Array<{
    nbuCodeSnapshot: string;
    nameSnapshot: string;
    authorizationStatus: 'no_aplica' | 'pendiente' | 'autorizada' | 'rechazada';
    authorizationCode: string | null;
    section: string | null;
    isElaborated: boolean;
  }>;
  lab: Laboratorio;
  logoDataUri?: string | null;
}

export async function renderFichaPdf(input: RenderFichaInput): Promise<Buffer> {
  ensureFontsRegistered();
  const { order, patient, insurer, lines, lab } = input;
  const logoSrc =
    input.logoDataUri !== undefined
      ? (input.logoDataUri ?? getLogoFallback())
      : lab.logoPath || getLogoFallback();

  const data: FichaData = {
    lab: {
      legalName: lab.legalName,
      cuit: lab.cuit ?? '',
      address: lab.streetAddress ?? '',
      cityProvince: `${lab.city ?? ''}, ${lab.province ?? ''}`,
      phone: lab.phone,
      email: lab.email,
      logoSrc,
    },
    protocol: {
      number: String(order.protocolNumber).padStart(8, '0'),
      orderDate: formatDate(order.orderDate),
      isUrgent: order.isUrgent,
    },
    patient: {
      fullName: `${patient.lastName}, ${patient.firstName}`,
      dni: patient.dni,
      sex: patient.sex,
      age: patient.birthDate ? ageString(patient.birthDate) : '—',
      birthDate: patient.birthDate ? formatDate(patient.birthDate) : '—',
    },
    insurer: {
      name: insurer.name,
      affiliateNumber: order.insuranceAffiliateNumber,
    },
    doctor: {
      name: order.referringDoctorName,
      mp: order.referringDoctorMp,
      diagnosis: order.diagnosis,
      notes: order.notes,
    },
    practices: lines.map((l) => ({
      nbuCode: l.nbuCodeSnapshot,
      name: l.nameSnapshot,
      section: l.section,
      isElaborated: l.isElaborated,
      authorizationStatus: l.authorizationStatus,
      authorizationCode: l.authorizationCode,
    })),
    printedAt: formatDateTime(new Date()),
  };

  return renderToBuffer(<FichaTemplate data={data} />);
}

export function buildInformeData(input: RenderInformeInput): InformeData {
  const {
    order,
    patient,
    insurer,
    lines,
    resultsByLineId,
    unidadValuesByLineId,
    practiceDataById,
    lab,
  } = input;
  const logoSrc =
    input.logoDataUri !== undefined
      ? (input.logoDataUri ?? getLogoFallback())
      : lab.logoPath || getLogoFallback();

  const pref = input.preferenciaPdf;
  const rawLayout = pref?.layoutConfig as
    | { campos?: Record<string, { x: number; y: number; fontSize?: number; color?: string }> }
    | null
    | undefined;
  const layoutConfig = rawLayout?.campos ?? null;

  return {
    lab: {
      legalName: lab.legalName,
      cuit: lab.cuit ?? '',
      address: lab.streetAddress ?? '',
      cityProvince: `${lab.city ?? ''}, ${lab.province ?? ''}`,
      phone: lab.phone,
      email: lab.email,
      logoSrc,
    },
    protocol: {
      number: String(order.protocolNumber).padStart(8, '0'),
      orderDate: formatDate(order.orderDate),
      issuedAt: formatDateTime(order.pdfReportIssuedAt ?? new Date()),
    },
    patient: {
      fullName: `${patient.lastName}, ${patient.firstName}`,
      dni: patient.dni,
      sex: patient.sex,
      age: patient.birthDate ? ageString(patient.birthDate) : '—',
      birthDate: patient.birthDate ? formatDate(patient.birthDate) : '—',
    },
    insurer: {
      name: insurer.name,
      affiliateNumber: order.insuranceAffiliateNumber,
    },
    doctor: {
      name: order.referringDoctorName,
      mp: order.referringDoctorMp,
      diagnosis: order.diagnosis,
    },
    results: lines
      .filter((l) => l.includeInReport && l.practiceId !== null)
      .map((l) => {
        const r = resultsByLineId.get(l.id);
        const value = r?.valueNumeric ? cleanNumber(r.valueNumeric) : (r?.valueText ?? '');
        const rawUnidades = unidadValuesByLineId?.get(l.id) ?? [];
        const unidades: InformeUnidadRow[] = rawUnidades.map((u) => ({
          nombre: u.unidadNombreSnapshot,
          simbolo: u.unidadSimboloSnapshot,
          value: u.valueNumeric ? cleanNumber(u.valueNumeric) : (u.valueText ?? ''),
        }));
        const practiceData = l.practiceId ? (practiceDataById?.get(l.practiceId) ?? null) : null;
        return {
          nbuCode: l.nbuCodeSnapshot,
          name: l.nameSnapshot,
          value,
          unit: r?.unit ?? null,
          range: r ? formatRange(r.referenceRangeLow, r.referenceRangeHigh, r.unit) : null,
          flag: r?.flag ?? null,
          methodology: r?.methodology || practiceData?.methodology || null,
          referenceValue: practiceData?.referenceValue ?? null,
          notes: r?.notes ?? null,
          unidades: unidades.length > 0 ? unidades : undefined,
        };
      }),
    signedBy: {
      name: lab.signingProfessionalName ?? '',
      matricula: lab.signingProfessionalMp
        ? lab.signingProfessionalMp.startsWith('M.P.')
          ? lab.signingProfessionalMp
          : `M.P. ${lab.signingProfessionalMp}`
        : null,
      signatureSrc: input.signatureDataUri ?? null,
    },
    fondoSrc: input.fondoDataUri ?? null,
    layoutConfig,
    margins: pref
      ? {
          top: pref.marginTop,
          bottom: pref.marginBottom,
          left: pref.marginLeft,
          right: pref.marginRight,
        }
      : undefined,
  };
}

const TZ = 'America/Argentina/Cordoba';

function formatDate(d: Date | string): string {
  const date = d instanceof Date ? d : new Date(d);
  return date.toLocaleDateString('es-AR', { timeZone: TZ });
}

function formatDateTime(d: Date | string): string {
  const date = d instanceof Date ? d : new Date(d);
  return date.toLocaleString('es-AR', { timeZone: TZ, hour12: false });
}

function ageString(birth: Date | string): string {
  const b = birth instanceof Date ? birth : new Date(birth);
  const diffMs = Date.now() - b.getTime();
  if (diffMs < 0) return '0 años';
  const years = Math.floor(diffMs / (365.2425 * 24 * 60 * 60 * 1000));
  return `${years} años`;
}

function cleanNumber(s: string): string {
  if (!/^-?\d+(\.\d+)?$/.test(s)) return s;
  const [int, dec = ''] = s.split('.');
  const trimmed = dec.replace(/0+$/, '');
  return trimmed ? `${int},${trimmed}` : int;
}

function formatRange(low: string | null, high: string | null, unit: string | null): string | null {
  if (!low && !high) return null;
  const a = low ? cleanNumber(low) : '−∞';
  const b = high ? cleanNumber(high) : '+∞';
  return `${a} – ${b}${unit ? ` ${unit}` : ''}`;
}
