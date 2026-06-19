import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type {
  Laboratorio,
  Order,
  OrderPractice,
  OrderPracticeUnidadValue,
  Patient,
  PreferenciaPdf,
  Result,
  Sede,
} from '@/db/schema';
import { Font, renderToBuffer } from '@react-pdf/renderer';
import { ContratoFirmadoTemplate, ContratoTemplate } from './templates/contrato';
import type { ContratoData, ContratoFirmadoData } from './templates/contrato';
import { type FichaData, FichaTemplate } from './templates/ficha';
import { type InformeData, InformeTemplate, type InformeUnidadRow } from './templates/informe';

const FONTS_DIR = join(__dirname, 'fonts');
let fontsRegistered = false;

function ensureFontsRegistered(): void {
  if (fontsRegistered) return;
  Font.register({
    family: 'Roboto',
    fonts: [
      { src: join(FONTS_DIR, 'Roboto-Regular.ttf'), fontWeight: 'normal' },
      { src: join(FONTS_DIR, 'Roboto-Bold.ttf'), fontWeight: 'bold' },
    ],
  });

  // Public Sans — descargado. Source Serif 4 — fallback a Times-Roman (descarga falló).
  // TODO: reemplazar Times-Roman por SourceSerif4-Regular.ttf / SourceSerif4-Bold.ttf
  // cuando se pueda descargar desde google/fonts (el repo usa estructura de carpetas
  // distinta a la esperada).
  const publicSansRegularPath = join(FONTS_DIR, 'PublicSans-Regular.ttf');
  const publicSansSemiBoldPath = join(FONTS_DIR, 'PublicSans-SemiBold.ttf');
  const sourceSerif4RegularPath = join(FONTS_DIR, 'SourceSerif4-Regular.ttf');
  const sourceSerif4BoldPath = join(FONTS_DIR, 'SourceSerif4-Bold.ttf');

  if (existsSync(publicSansRegularPath)) {
    Font.register({ family: 'PublicSans', src: publicSansRegularPath, fontWeight: 'normal' });
  } else {
    Font.register({ family: 'PublicSans', src: 'Helvetica', fontWeight: 'normal' });
  }
  if (existsSync(publicSansSemiBoldPath)) {
    Font.register({
      family: 'PublicSansSemiBold',
      src: publicSansSemiBoldPath,
      fontWeight: 'normal',
    });
  } else {
    Font.register({ family: 'PublicSansSemiBold', src: 'Helvetica-Bold', fontWeight: 'normal' });
  }
  if (existsSync(sourceSerif4RegularPath)) {
    Font.register({ family: 'SourceSerif4', src: sourceSerif4RegularPath, fontWeight: 'normal' });
  } else {
    Font.register({ family: 'SourceSerif4', src: 'Times-Roman', fontWeight: 'normal' });
  }
  if (existsSync(sourceSerif4BoldPath)) {
    Font.register({ family: 'SourceSerif4Bold', src: sourceSerif4BoldPath, fontWeight: 'normal' });
  } else {
    Font.register({ family: 'SourceSerif4Bold', src: 'Times-Bold', fontWeight: 'normal' });
  }

  // Registrar 'Helvetica' como alias de PublicSans para que el fallback interno
  // de @react-pdf/layout (que agrega 'Helvetica' a todo fontStack) resuelva
  // correctamente cuando ningún glyph del font principal cubre el codepoint
  // (ej: caracteres de control como \n que generan párrafos vacíos).
  const helveticaSrc = existsSync(publicSansRegularPath) ? publicSansRegularPath : 'Helvetica';
  Font.register({ family: 'Helvetica', src: helveticaSrc, fontWeight: 'normal' });

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
  /** Sede principal del lab (se imprime al pie). */
  sede?: Sede | null;
  /** QR (PNG data-URI) del portal público del informe (F7). */
  qrCodeDataUri?: string | null;
}

// ── Acento de marca en el PDF (derivado del primaryColor del lab) ──────────────
// El header de la tabla usa texto BLANCO sobre el acento, así que oscurecemos el
// color hasta garantizar contraste legible (WCAG) antes de usarlo. react-pdf no
// soporta color-mix, por eso la matemática va en JS.
const DEFAULT_PDF_ACCENT = '#1f2b5b';
type Rgb = [number, number, number];

function parseHex(hex: string): Rgb | null {
  const m = /^#([0-9a-fA-F]{6})$/.exec(hex.trim());
  if (!m) return null;
  const n = Number.parseInt(m[1], 16);
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

function rgbToHex([r, g, b]: Rgb): string {
  const h = (c: number) =>
    Math.max(0, Math.min(255, Math.round(c)))
      .toString(16)
      .padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`;
}

function mix(a: Rgb, b: Rgb, t: number): Rgb {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

function relLuminance([r, g, b]: Rgb): number {
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function contrastWithWhite(rgb: Rgb): number {
  return 1.05 / (relLuminance(rgb) + 0.05);
}

/** Acento + tinte suave legibles a partir del primaryColor del lab. */
export function pdfAccentPalette(primaryColor: string | null | undefined): {
  accent: string;
  accentSoft: string;
} {
  let rgb = (primaryColor && parseHex(primaryColor)) || (parseHex(DEFAULT_PDF_ACCENT) as Rgb);
  // Oscurece hasta que texto blanco sobre el acento tenga contraste >= 4.0.
  let guard = 0;
  while (contrastWithWhite(rgb) < 4.0 && guard < 10) {
    rgb = mix(rgb, [0, 0, 0], 0.1);
    guard++;
  }
  const accentSoft = mix(rgb, [255, 255, 255], 0.88); // ~12% acento sobre blanco
  return { accent: rgbToHex(rgb), accentSoft: rgbToHex(accentSoft) };
}

function sedeForTemplate(s: Sede | null | undefined): InformeData['sede'] {
  if (!s) return null;
  return {
    nombre: s.nombre,
    direccion: s.direccion,
    localidad: s.localidad,
    telefono: s.telefono,
    horarios: s.horarios,
  };
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
  const logoSrc = input.logoDataUri !== undefined ? input.logoDataUri : (lab.logoPath ?? null);

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
  const logoSrc = input.logoDataUri !== undefined ? input.logoDataUri : (lab.logoPath ?? null);

  const pref = input.preferenciaPdf;
  const rawLayout = pref?.layoutConfig as
    | {
        usarFondo?: boolean;
        campos?: Record<string, { x: number; y: number; fontSize?: number; color?: string; prefix?: string }>;
      }
    | null
    | undefined;
  const layoutConfig = rawLayout?.campos ?? null;
  // Solo se dibuja el fondo si el admin no lo desactivó (undefined/true => dibujar).
  const fondoSrc = rawLayout?.usarFondo === false ? null : (input.fondoDataUri ?? null);
  // White-label: el acento del informe = el color de marca del lab (fallback navy Banco Vital).
  const { accent, accentSoft } = pdfAccentPalette(lab.primaryColor);

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
      streetAddress: patient.streetAddress,
      city: patient.city,
      phone: patient.phone,
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
    order: {
      origin: order.origin,
      isUrgent: order.isUrgent,
      notes: order.notes,
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
    fondoSrc,
    layoutConfig,
    margins: pref
      ? {
          top: pref.marginTop,
          bottom: pref.marginBottom,
          left: pref.marginLeft,
          right: pref.marginRight,
        }
      : undefined,
    accent,
    accentSoft,
    sede: sedeForTemplate(input.sede),
    qrCodeDataUri: input.qrCodeDataUri ?? null,
  };
}

/** Renderiza el informe directamente desde un InformeData ya armado (usado por el preview). */
export async function renderInformeFromData(data: InformeData): Promise<Buffer> {
  ensureFontsRegistered();
  return renderToBuffer(<InformeTemplate data={data} />);
}

export interface SampleInformeAssets {
  lab: Laboratorio;
  preferenciaPdf?: PreferenciaPdf | null;
  logoSrc?: string | null;
  signatureSrc?: string | null;
  fondoSrc?: string | null;
  sede?: Sede | null;
}

/**
 * Arma un InformeData de MUESTRA con la marca REAL del lab (logo, firma, fondo,
 * márgenes, acento) y datos de paciente/resultados ficticios. Para el preview del
 * editor de PDF — el admin ve el informe real sin necesitar una orden cargada.
 */
export function buildSampleInformeData(opts: SampleInformeAssets): InformeData {
  const { lab, preferenciaPdf: pref } = opts;
  // White-label: el acento del informe = el color de marca del lab (fallback navy Banco Vital).
  const { accent, accentSoft } = pdfAccentPalette(lab.primaryColor);
  const rawLayout = pref?.layoutConfig as
    | { usarFondo?: boolean; campos?: Record<string, { x: number; y: number; fontSize?: number; color?: string; prefix?: string }> }
    | null
    | undefined;
  const usarFondo = rawLayout?.usarFondo;
  return {
    lab: {
      legalName: lab.legalName,
      cuit: lab.cuit ?? '',
      address: lab.streetAddress ?? '',
      cityProvince: `${lab.city ?? ''}, ${lab.province ?? ''}`,
      phone: lab.phone,
      email: lab.email,
      logoSrc: opts.logoSrc ?? null,
    },
    protocol: { number: '00012345', orderDate: '01/06/2026', issuedAt: '01/06/2026, 10:30:00' },
    patient: {
      fullName: 'Pérez, María',
      dni: '30.123.456',
      sex: 'F',
      age: '34 años',
      birthDate: '15/03/1992',
      streetAddress: 'Av. Siempre Viva 742',
      city: 'Santa Fe',
      phone: '342-4567890',
    },
    insurer: { name: 'OSDE', affiliateNumber: '61234567-01' },
    doctor: { name: 'Dr. Juan Gómez', mp: '12345', diagnosis: 'Control anual' },
    order: { origin: 'Ambulatorio', isUrgent: false, notes: null },
    results: [
      {
        nbuCode: '660045',
        name: 'Glucemia',
        value: '92',
        unit: 'mg/dL',
        range: '70 – 110 mg/dL',
        flag: 'normal',
        methodology: 'Enzimático',
        referenceValue: null,
        notes: null,
      },
      {
        nbuCode: '660122',
        name: 'Colesterol total',
        value: '215',
        unit: 'mg/dL',
        range: '< 200 mg/dL',
        flag: 'high',
        methodology: 'Colorimétrico',
        referenceValue: null,
        notes: null,
      },
      {
        nbuCode: '660500',
        name: 'Hemoglobina glicosilada',
        value: '5,4',
        unit: '%',
        range: '4,0 – 6,0 %',
        flag: 'normal',
        methodology: 'HPLC',
        referenceValue: null,
        notes: null,
      },
    ],
    signedBy: {
      name: lab.signingProfessionalName ?? 'Bioquímico/a responsable',
      matricula: lab.signingProfessionalMp
        ? lab.signingProfessionalMp.startsWith('M.P.')
          ? lab.signingProfessionalMp
          : `M.P. ${lab.signingProfessionalMp}`
        : 'M.P. 0000',
      signatureSrc: opts.signatureSrc ?? null,
    },
    fondoSrc: usarFondo === false ? null : (opts.fondoSrc ?? null),
    layoutConfig: rawLayout?.campos ?? null,
    margins: pref
      ? {
          top: pref.marginTop,
          bottom: pref.marginBottom,
          left: pref.marginLeft,
          right: pref.marginRight,
        }
      : undefined,
    accent,
    accentSoft,
    sede: sedeForTemplate(opts.sede),
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

// ── Contrato ───────────────────────────────────────────────────────────────────

export type { ContratoData, ContratoFirmadoData };

export async function renderContratoPdf(data: ContratoData): Promise<Buffer> {
  ensureFontsRegistered();
  return renderToBuffer(<ContratoTemplate data={data} />);
}

export async function renderContratoFirmadoPdf(data: ContratoFirmadoData): Promise<Buffer> {
  ensureFontsRegistered();
  return renderToBuffer(<ContratoFirmadoTemplate data={data} />);
}
