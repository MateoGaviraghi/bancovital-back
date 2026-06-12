/**
 * Script one-shot: puebla el laboratorio `default` con datos demo realistas para QA visual.
 *
 * Uso:
 *   pnpm dlx tsx src/dev/create-demo-data.ts          # crea; aborta si ya hay datos
 *   RESET=1 pnpm dlx tsx src/dev/create-demo-data.ts  # borra y recrea
 *
 * NO toca: planes, suscripciones, ciclos de consumo, usuarios, laboratorios.
 * NO incrementa ciclo_consumo. Las órdenes se insertan directo con es_excedente=false.
 * NUNCA actualiza order_practice (trigger trg_order_practice_immutable lo bloquea).
 */
import 'dotenv/config';
import { closeDb, getDb } from '@/db/client';
import {
  doctor,
  insurer,
  laboratorio,
  order,
  orderPractice,
  patient,
  practice,
  result,
  ubValue,
  user,
} from '@/db/schema';
import Decimal from 'decimal.js';
import { and, eq, inArray, isNull, sql } from 'drizzle-orm';

Decimal.set({ precision: 30, rounding: Decimal.ROUND_HALF_UP });

const LAB_SLUG = 'default';
const RESET = process.env.RESET === '1';

// ─── Helpers de pricing (reproducen domain/pricing/pricing.ts sin IO) ──────────

function money(units: string, ub: string): string {
  return new Decimal(units).times(new Decimal(ub)).toFixed(2);
}

// ─── Datos demo ────────────────────────────────────────────────────────────────

const PATIENTS_DATA = [
  {
    firstName: 'Lucía',
    lastName: 'Fernández',
    dni: '32145678',
    sex: 'F' as const,
    birth: new Date('1985-03-12'),
    phone: '3415001111',
    email: 'lucia.fernandez@demo.com',
  },
  {
    firstName: 'Martín',
    lastName: 'González',
    dni: '28901234',
    sex: 'M' as const,
    birth: new Date('1978-07-24'),
    phone: '3415002222',
    email: null,
  },
  {
    firstName: 'Valentina',
    lastName: 'López',
    dni: '40567890',
    sex: 'F' as const,
    birth: new Date('1998-11-05'),
    phone: '3415003333',
    email: 'v.lopez@demo.com',
  },
  {
    firstName: 'Carlos',
    lastName: 'Ramírez',
    dni: '25234567',
    sex: 'M' as const,
    birth: new Date('1965-01-30'),
    phone: '3415004444',
    email: null,
  },
  {
    firstName: 'María',
    lastName: 'Díaz',
    dni: '35678901',
    sex: 'F' as const,
    birth: new Date('1991-06-18'),
    phone: '3415005555',
    email: 'maria.diaz@demo.com',
  },
  {
    firstName: 'Sebastián',
    lastName: 'Rodríguez',
    dni: '30123456',
    sex: 'M' as const,
    birth: new Date('1982-09-07'),
    phone: '3415006666',
    email: null,
  },
  {
    firstName: 'Florencia',
    lastName: 'Martínez',
    dni: '38456789',
    sex: 'F' as const,
    birth: new Date('1995-04-22'),
    phone: '3415007777',
    email: 'flor.martinez@demo.com',
  },
  {
    firstName: 'Agustín',
    lastName: 'Herrera',
    dni: '27890123',
    sex: 'M' as const,
    birth: new Date('1973-12-14'),
    phone: '3415008888',
    email: null,
  },
  {
    firstName: 'Camila',
    lastName: 'Torres',
    dni: '42345678',
    sex: 'F' as const,
    birth: new Date('2002-08-09'),
    phone: '3415009999',
    email: 'camila.torres@demo.com',
  },
  {
    firstName: 'Roberto',
    lastName: 'Sánchez',
    dni: '22678901',
    sex: 'M' as const,
    birth: new Date('1955-02-28'),
    phone: '3415010101',
    email: null,
  },
  {
    firstName: 'Antonella',
    lastName: 'Moreno',
    dni: '44901234',
    sex: 'F' as const,
    birth: new Date('2005-10-03'),
    phone: '3415011111',
    email: 'antonella.moreno@demo.com',
  },
  {
    firstName: 'Diego',
    lastName: 'Jiménez',
    dni: '31567890',
    sex: 'M' as const,
    birth: new Date('1988-05-17'),
    phone: '3415012222',
    email: 'diego.j@demo.com',
  },
];

const DOCTORS_DATA = [
  { firstName: 'Ana María', lastName: 'Suárez', matricula: 'MP12345', specialty: 'Clínica Médica' },
  { firstName: 'Jorge', lastName: 'Peralta', matricula: 'MP23456', specialty: 'Cardiología' },
  { firstName: 'Verónica', lastName: 'Castro', matricula: 'MP34567', specialty: 'Endocrinología' },
  { firstName: 'Pablo', lastName: 'Ríos', matricula: 'MP45678', specialty: 'Medicina General' },
];

// Prácticas elegidas: comunes, con units no null
// id => { nbuCode, name, units }
const SELECTED_PRACTICE_IDS = {
  glucemia: { id: 1, nbuCode: '0301', name: 'Glucemia', units: '1.50', isSpecialAct: false },
  hemograma: {
    id: 2,
    nbuCode: '0501',
    name: 'Hemograma completo',
    units: '5.00',
    isSpecialAct: false,
  },
  colesterol: {
    id: 3,
    nbuCode: '0902',
    name: 'Colesterol total',
    units: '2.00',
    isSpecialAct: false,
  },
  albumina: {
    id: 14,
    nbuCode: '660015',
    name: 'ALBUMINA sérica',
    units: '1.50',
    isSpecialAct: false,
  },
  fosfatasaAlc: {
    id: 166,
    nbuCode: '660357',
    name: 'FOSFATASA ALCALINA (FAL)',
    units: '1.50',
    isSpecialAct: false,
  },
  trigliceridos: {
    id: 374,
    nbuCode: '660876',
    name: 'TRIGLICERIDOS (Tg)',
    units: '2.50',
    isSpecialAct: false,
  },
  urea: { id: 381, nbuCode: '660902', name: 'UREA, sérica', units: '1.50', isSpecialAct: false },
  creatinina: {
    id: 112,
    nbuCode: '660192',
    name: 'CREATININA en sangre',
    units: '3.00',
    isSpecialAct: false,
  },
  hdl: {
    id: 408,
    nbuCode: '661035',
    name: 'COLESTEROL HDL (HDL-C)',
    units: '3.00',
    isSpecialAct: false,
  },
  ldl: {
    id: 409,
    nbuCode: '661040',
    name: 'COLESTEROL LDL (LDL-C)',
    units: '4.50',
    isSpecialAct: false,
  },
  tsh: { id: 363, nbuCode: '660865', name: 'TIROTROFINA TSH', units: '9.00', isSpecialAct: false },
  amilasa: {
    id: 20,
    nbuCode: '660022',
    name: 'AMILASA sérica',
    units: '4.00',
    isSpecialAct: false,
  },
};

type PracticeDef = {
  id: number;
  nbuCode: string;
  name: string;
  units: string;
  isSpecialAct: boolean;
};

// 10 órdenes: mix de estados del FSM
// statuses: borrador(2), confirmada(2), en_proceso(2), resultados_cargados(2), emitida(2)
const ORDER_TEMPLATES: {
  status: 'borrador' | 'confirmada' | 'en_proceso' | 'resultados_cargados' | 'emitida';
  patientIdx: number;
  doctorIdx: number;
  practices: PracticeDef[];
  isUrgent: boolean;
  daysAgo: number;
  origin: 'ambulatorio' | 'internacion' | 'urgencia';
  diagnosis?: string;
}[] = [
  // borrador
  {
    status: 'borrador',
    patientIdx: 0,
    doctorIdx: 0,
    practices: [SELECTED_PRACTICE_IDS.glucemia, SELECTED_PRACTICE_IDS.hemograma],
    isUrgent: false,
    daysAgo: 1,
    origin: 'ambulatorio',
  },
  {
    status: 'borrador',
    patientIdx: 1,
    doctorIdx: 1,
    practices: [
      SELECTED_PRACTICE_IDS.colesterol,
      SELECTED_PRACTICE_IDS.trigliceridos,
      SELECTED_PRACTICE_IDS.hdl,
      SELECTED_PRACTICE_IDS.ldl,
    ],
    isUrgent: false,
    daysAgo: 2,
    origin: 'ambulatorio',
    diagnosis: 'Perfil lipídico de control',
  },
  // confirmada
  {
    status: 'confirmada',
    patientIdx: 2,
    doctorIdx: 2,
    practices: [SELECTED_PRACTICE_IDS.tsh, SELECTED_PRACTICE_IDS.glucemia],
    isUrgent: false,
    daysAgo: 3,
    origin: 'ambulatorio',
    diagnosis: 'Control tiroideo',
  },
  {
    status: 'confirmada',
    patientIdx: 3,
    doctorIdx: 3,
    practices: [
      SELECTED_PRACTICE_IDS.urea,
      SELECTED_PRACTICE_IDS.creatinina,
      SELECTED_PRACTICE_IDS.albumina,
    ],
    isUrgent: true,
    daysAgo: 4,
    origin: 'urgencia',
    diagnosis: 'Insuficiencia renal aguda — control',
  },
  // en_proceso
  {
    status: 'en_proceso',
    patientIdx: 4,
    doctorIdx: 0,
    practices: [
      SELECTED_PRACTICE_IDS.hemograma,
      SELECTED_PRACTICE_IDS.glucemia,
      SELECTED_PRACTICE_IDS.urea,
    ],
    isUrgent: false,
    daysAgo: 6,
    origin: 'ambulatorio',
    diagnosis: 'Chequeo anual',
  },
  {
    status: 'en_proceso',
    patientIdx: 5,
    doctorIdx: 1,
    practices: [
      SELECTED_PRACTICE_IDS.colesterol,
      SELECTED_PRACTICE_IDS.trigliceridos,
      SELECTED_PRACTICE_IDS.fosfatasaAlc,
      SELECTED_PRACTICE_IDS.amilasa,
    ],
    isUrgent: false,
    daysAgo: 7,
    origin: 'ambulatorio',
  },
  // resultados_cargados
  {
    status: 'resultados_cargados',
    patientIdx: 6,
    doctorIdx: 2,
    practices: [
      SELECTED_PRACTICE_IDS.glucemia,
      SELECTED_PRACTICE_IDS.hemograma,
      SELECTED_PRACTICE_IDS.creatinina,
    ],
    isUrgent: false,
    daysAgo: 10,
    origin: 'ambulatorio',
    diagnosis: 'Diabetes — seguimiento',
  },
  {
    status: 'resultados_cargados',
    patientIdx: 7,
    doctorIdx: 3,
    practices: [SELECTED_PRACTICE_IDS.tsh, SELECTED_PRACTICE_IDS.albumina],
    isUrgent: false,
    daysAgo: 12,
    origin: 'ambulatorio',
  },
  // emitida
  {
    status: 'emitida',
    patientIdx: 8,
    doctorIdx: 0,
    practices: [
      SELECTED_PRACTICE_IDS.hemograma,
      SELECTED_PRACTICE_IDS.glucemia,
      SELECTED_PRACTICE_IDS.urea,
      SELECTED_PRACTICE_IDS.creatinina,
    ],
    isUrgent: false,
    daysAgo: 15,
    origin: 'ambulatorio',
    diagnosis: 'Prequirúrgico',
  },
  {
    status: 'emitida',
    patientIdx: 9,
    doctorIdx: 1,
    practices: [
      SELECTED_PRACTICE_IDS.colesterol,
      SELECTED_PRACTICE_IDS.hdl,
      SELECTED_PRACTICE_IDS.ldl,
      SELECTED_PRACTICE_IDS.trigliceridos,
    ],
    isUrgent: false,
    daysAgo: 18,
    origin: 'ambulatorio',
    diagnosis: 'Riesgo cardiovascular',
  },
];

// Resultados demo por práctica: [valueNumeric, unit, refLow, refHigh, flag]
const RESULT_DATA: Record<
  string,
  [
    number,
    string,
    number | null,
    number | null,
    'normal' | 'low' | 'high' | 'critical_low' | 'critical_high',
  ]
> = {
  '0301': [112, 'mg/dL', 70, 110, 'high'], // Glucemia levemente alta
  '0501': [4.8, '10^6/µL', 4.2, 5.4, 'normal'], // Hemograma (GR)
  '0902': [215, 'mg/dL', 0, 200, 'high'], // Colesterol total elevado
  '660015': [4.1, 'g/dL', 3.5, 5.0, 'normal'], // Albumina
  '660357': [98, 'UI/L', 44, 147, 'normal'], // FAL
  '660876': [185, 'mg/dL', 0, 150, 'high'], // Triglicéridos altos
  '660902': [28, 'mg/dL', 10, 50, 'normal'], // Urea
  '660192': [0.85, 'mg/dL', 0.6, 1.2, 'normal'], // Creatinina
  '661035': [38, 'mg/dL', 40, 60, 'low'], // HDL bajo
  '661040': [128, 'mg/dL', 0, 100, 'high'], // LDL alto
  '660865': [3.2, 'µUI/mL', 0.4, 4.0, 'normal'], // TSH
  '660022': [62, 'UI/L', 25, 100, 'normal'], // Amilasa
};

// ─── Utilidades ────────────────────────────────────────────────────────────────

function daysAgoDate(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(9 + Math.floor(Math.random() * 6), Math.floor(Math.random() * 60), 0, 0);
  return d;
}

// ─── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const db = getDb();

  // Resolver lab
  const [lab] = await db
    .select({ id: laboratorio.id })
    .from(laboratorio)
    .where(eq(laboratorio.slug, LAB_SLUG))
    .limit(1);
  if (!lab) throw new Error(`No existe laboratorio con slug '${LAB_SLUG}'`);
  const labId = lab.id;

  // Idempotencia: verificar si ya hay pacientes
  const [{ count: patientCount }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(patient)
    .where(and(eq(patient.labId, labId), isNull(patient.deletedAt)));

  if (patientCount > 0 && !RESET) {
    console.error(`\nYa hay ${patientCount} paciente(s) en el lab '${LAB_SLUG}'.`);
    console.error('Correlo con RESET=1 para limpiar y recrear.\n');
    process.exit(1);
  }

  if (RESET && patientCount > 0) {
    console.log('RESET=1 — limpiando datos demo existentes...');

    // Obtener IDs de órdenes del lab
    const orderRows = await db.select({ id: order.id }).from(order).where(eq(order.labId, labId));
    const orderIds = orderRows.map((o) => o.id);

    if (orderIds.length > 0) {
      // Obtener order_practice IDs para borrar results
      const opRows = await db
        .select({ id: orderPractice.id })
        .from(orderPractice)
        .where(inArray(orderPractice.orderId, orderIds));
      const opIds = opRows.map((op) => op.id);

      if (opIds.length > 0) {
        await db.delete(result).where(inArray(result.orderPracticeId, opIds));
        console.log('  ✓ results borrados');
      }
      // order_practice se borra en cascade al borrar orders
      await db.delete(order).where(inArray(order.id, orderIds));
      console.log('  ✓ órdenes (y líneas) borradas');
    }

    await db.delete(doctor).where(eq(doctor.labId, labId));
    console.log('  ✓ médicos borrados');

    // Hard delete pacientes (no hay soft-delete constraint que impida)
    await db.delete(patient).where(eq(patient.labId, labId));
    console.log('  ✓ pacientes borrados');
  }

  // ── 1. UB values para las insurers que no tienen ────────────────────────────
  console.log('\n── Asegurando UB values...');
  const insurers = await db.select().from(insurer);
  const existingUbs = await db
    .select({ insurerId: ubValue.insurerId })
    .from(ubValue)
    .where(isNull(ubValue.validTo));
  const insurersWithUb = new Set(existingUbs.map((u) => u.insurerId));

  // Valores UB realistas por código
  const UB_POR_CODIGO: Record<string, string> = {
    PARTICULAR: '2000.00',
    IAPOS: '1800.00',
    OSDE: '2200.00',
    PAMI: '1500.00',
    GALENO: '2100.00',
    SWISS: '2400.00',
  };

  const insurersToAdd = insurers.filter((ins) => !insurersWithUb.has(ins.id));
  for (const ins of insurersToAdd) {
    const value = UB_POR_CODIGO[ins.code] ?? '1800.00';
    await db.insert(ubValue).values({
      insurerId: ins.id,
      validFrom: new Date('2026-01-01'),
      value,
      notes: 'UB demo seed',
    });
    console.log(`  ✓ UB ${ins.code}: $${value}`);
  }

  // Recargar UBs vigentes
  const ubRows = await db
    .select({ insurerId: ubValue.insurerId, value: ubValue.value })
    .from(ubValue)
    .where(isNull(ubValue.validTo));
  const ubByInsurerId = new Map(ubRows.map((u) => [u.insurerId, u.value]));

  // PARTICULAR UB (para priceParticular)
  const particularInsurer = insurers.find((i) => i.code === 'PARTICULAR');
  if (!particularInsurer) throw new Error('Insurer PARTICULAR no encontrado');
  const ubParticular = ubByInsurerId.get(particularInsurer.id) ?? '2000.00';

  // ── 2. Pacientes ─────────────────────────────────────────────────────────────
  console.log('\n── Creando pacientes...');

  // Asignar obra social: repartir entre las primeras 4 insurers (IAPOS, OSDE, PAMI, GALENO)
  // 4 pacientes sin obra social (particular)
  const insurersForPatients = insurers.filter((i) => i.code !== 'PARTICULAR').slice(0, 4);
  const particularId = particularInsurer.id;

  const patientIds: number[] = [];
  for (let i = 0; i < PATIENTS_DATA.length; i++) {
    const p = PATIENTS_DATA[i]!;
    // 4 de 12 con particular (sin obra social efectiva, usamos PARTICULAR)
    const assignedInsurer =
      i < 8 ? insurersForPatients[i % insurersForPatients.length]! : { id: particularId };

    const [inserted] = await db
      .insert(patient)
      .values({
        labId,
        dni: p.dni,
        firstName: p.firstName,
        lastName: p.lastName,
        sex: p.sex,
        birthDate: p.birth,
        phone: p.phone,
        email: p.email ?? undefined,
        city: 'Santa Fe',
      })
      .returning({ id: patient.id });

    patientIds.push(inserted!.id);
    console.log(
      `  ✓ ${p.firstName} ${p.lastName} (${p.dni}) → OS: ${assignedInsurer.id === particularId ? 'Particular' : insurers.find((ins) => ins.id === assignedInsurer.id)?.name}`,
    );
  }

  // ── 3. Médicos ────────────────────────────────────────────────────────────────
  console.log('\n── Creando médicos...');
  const doctorIds: number[] = [];
  for (const d of DOCTORS_DATA) {
    const [inserted] = await db
      .insert(doctor)
      .values({
        labId,
        firstName: d.firstName,
        lastName: d.lastName,
        matricula: d.matricula,
        specialty: d.specialty,
      })
      .returning({ id: doctor.id });
    doctorIds.push(inserted!.id);
    console.log(`  ✓ Dr/a. ${d.firstName} ${d.lastName} (${d.matricula}) — ${d.specialty}`);
  }

  // ── 4. Conseguir un user UUID para enteredBy ──────────────────────────────────
  const [adminUser] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.labId, labId))
    .limit(1);
  if (!adminUser) throw new Error('No hay usuarios en el lab — corrí create-demo-users.ts primero');
  const enteredByUserId = adminUser.id;

  // ── 5. Verificar prácticas en DB ──────────────────────────────────────────────
  const allPracticeIds = [...new Set(ORDER_TEMPLATES.flatMap((t) => t.practices.map((p) => p.id)))];
  const existingPractices = await db
    .select({ id: practice.id, nbuCode: practice.nbuCode, units: practice.units })
    .from(practice)
    .where(inArray(practice.id, allPracticeIds));
  const practiceMap = new Map(existingPractices.map((p) => [p.id, p]));

  // ── 6. Órdenes ────────────────────────────────────────────────────────────────
  console.log('\n── Creando órdenes...');

  const createdOrderIds: number[] = [];

  // Mapa paciente → insurer (para la orden)
  const patientInsurerMap: Record<number, number> = {};
  for (let i = 0; i < PATIENTS_DATA.length; i++) {
    const assignedInsurer =
      i < 8 ? insurersForPatients[i % insurersForPatients.length]! : { id: particularId };
    patientInsurerMap[patientIds[i]!] = assignedInsurer.id;
  }

  for (let idx = 0; idx < ORDER_TEMPLATES.length; idx++) {
    const tmpl = ORDER_TEMPLATES[idx]!;
    const patientId = patientIds[tmpl.patientIdx]!;
    const doctorId = doctorIds[tmpl.doctorIdx]!;
    const insurerId = patientInsurerMap[patientId] ?? particularId;
    const ubInsurer = ubByInsurerId.get(insurerId) ?? ubParticular;
    const orderDate = daysAgoDate(tmpl.daysAgo);

    // Calcular líneas de pricing (reproduciendo calculateOrderPricing sin IO)
    type PricedLine = {
      practiceId: number | null;
      nbuCode: string;
      name: string;
      units: string;
      ubValue: string;
      priceParticular: string;
      priceInsurer: string;
      patientCopay: string;
    };
    const lines: PricedLine[] = [];

    for (const p of tmpl.practices) {
      // Usar units de la DB si disponible, sino del template
      const dbPractice = practiceMap.get(p.id);
      const units = dbPractice?.units ?? p.units;
      lines.push({
        practiceId: p.id,
        nbuCode: p.nbuCode,
        name: p.name,
        units,
        ubValue: ubInsurer,
        priceParticular: money(units, ubParticular),
        priceInsurer: money(units, ubInsurer),
        patientCopay: '0.00',
      });
    }

    // Special act: Acto bioquimico siempre
    lines.push({
      practiceId: null,
      nbuCode: '660001',
      name: 'Acto bioquimico',
      units: '1.00',
      ubValue: ubInsurer,
      priceParticular: money('1.00', ubParticular),
      priceInsurer: money('1.00', ubInsurer),
      patientCopay: '0.00',
    });

    // Urgencia si aplica
    if (tmpl.isUrgent) {
      lines.push({
        practiceId: null,
        nbuCode: '661200',
        name: 'Urgencia',
        units: '0.50',
        ubValue: ubInsurer,
        priceParticular: money('0.50', ubParticular),
        priceInsurer: money('0.50', ubInsurer),
        patientCopay: '0.00',
      });
    }

    const totalParticular = lines.reduce(
      (acc, l) => new Decimal(acc).plus(new Decimal(l.priceParticular)).toFixed(2),
      '0.00',
    );
    const totalInsurer = lines.reduce(
      (acc, l) => new Decimal(acc).plus(new Decimal(l.priceInsurer)).toFixed(2),
      '0.00',
    );

    // Insertar orden
    const [insertedOrder] = await db
      .insert(order)
      .values({
        labId,
        patientId,
        insurerId,
        referringDoctorId: doctorId,
        referringDoctorName: `${DOCTORS_DATA[tmpl.doctorIdx]!.firstName} ${DOCTORS_DATA[tmpl.doctorIdx]!.lastName}`,
        referringDoctorMp: DOCTORS_DATA[tmpl.doctorIdx]!.matricula,
        diagnosis: tmpl.diagnosis,
        origin: tmpl.origin,
        orderDate,
        status: tmpl.status,
        isUrgent: tmpl.isUrgent,
        totalParticular,
        totalInsurer,
        totalPatientCopay: '0.00',
        ubValueUsed: ubInsurer,
        esExcedente: false,
      })
      .returning({ id: order.id });

    const orderId = insertedOrder!.id;
    createdOrderIds.push(orderId);

    // Insertar líneas (NO actualizar — trigger inmutable)
    for (let li = 0; li < lines.length; li++) {
      const l = lines[li]!;
      await db.insert(orderPractice).values({
        orderId,
        practiceId: l.practiceId,
        nbuCodeSnapshot: l.nbuCode,
        nameSnapshot: l.name,
        unitsSnapshot: l.units,
        ubValueSnapshot: l.ubValue,
        priceParticular: l.priceParticular,
        priceInsurer: l.priceInsurer,
        patientCopay: l.patientCopay,
        authorizationStatus: 'no_aplica',
        includeInReport: true,
        sortOrder: li,
      });
    }

    const pat = PATIENTS_DATA[tmpl.patientIdx]!;
    console.log(
      `  ✓ Orden #${orderId} [${tmpl.status.padEnd(22)}] — ${pat.firstName} ${pat.lastName} — ${lines.length} líneas — total obra: $${totalInsurer}`,
    );
  }

  // ── 7. Resultados para órdenes resultados_cargados y emitidas ─────────────────
  console.log('\n── Cargando resultados...');

  const ordersNeedingResults = ORDER_TEMPLATES.filter(
    (t) => t.status === 'resultados_cargados' || t.status === 'emitida',
  );

  let resultCount = 0;
  for (const tmpl of ordersNeedingResults) {
    // Encontrar el orderId insertado (mismo índice en ORDER_TEMPLATES)
    const templateIdx = ORDER_TEMPLATES.indexOf(tmpl);
    const orderId = createdOrderIds[templateIdx]!;

    // Obtener las order_practice lines (solo las reales, no synthetic)
    const opLines = await db
      .select({ id: orderPractice.id, nbuCodeSnapshot: orderPractice.nbuCodeSnapshot })
      .from(orderPractice)
      .where(eq(orderPractice.orderId, orderId));

    for (const op of opLines) {
      const demo = RESULT_DATA[op.nbuCodeSnapshot];
      if (!demo) continue; // skip synthetic acts (660001, 661200)

      const [value, unit, refLow, refHigh, flag] = demo;

      await db.insert(result).values({
        orderPracticeId: op.id,
        valueNumeric: value.toString(),
        unit,
        referenceRangeLow: refLow != null ? refLow.toString() : undefined,
        referenceRangeHigh: refHigh != null ? refHigh.toString() : undefined,
        flag,
        enteredBy: enteredByUserId,
      });
      resultCount++;
    }

    console.log(`  ✓ Resultados cargados para orden #${orderId} [${tmpl.status}]`);
  }

  // ── 8. Verificación final ──────────────────────────────────────────────────────
  console.log('\n── Verificación final...');
  const [counts] = await db.execute(sql`
    SELECT
      (SELECT count(*)::int FROM patient     WHERE lab_id = ${labId} AND deleted_at IS NULL) AS patients,
      (SELECT count(*)::int FROM doctor      WHERE lab_id = ${labId} AND deleted_at IS NULL) AS doctors,
      (SELECT count(*)::int FROM "order"     WHERE lab_id = ${labId})                         AS orders,
      (SELECT count(*)::int FROM result      WHERE order_practice_id IN (
        SELECT op.id FROM order_practice op
        JOIN "order" o ON o.id = op.order_id
        WHERE o.lab_id = ${labId}
      ))                                                                                       AS results
  `);

  console.log('\n╔══════════════════════════════╗');
  console.log('║     DEMO DATA — RESUMEN      ║');
  console.log('╠══════════════════════════════╣');
  console.log(`║  Pacientes  : ${String(counts.patients).padStart(3)}             ║`);
  console.log(`║  Médicos    : ${String(counts.doctors).padStart(3)}             ║`);
  console.log(`║  Órdenes    : ${String(counts.orders).padStart(3)}             ║`);
  console.log(`║  Resultados : ${String(counts.results).padStart(3)}             ║`);
  console.log('╚══════════════════════════════╝');

  const statuses = ORDER_TEMPLATES.map((t) => t.status);
  const statusCounts: Record<string, number> = {};
  for (const s of statuses) statusCounts[s] = (statusCounts[s] ?? 0) + 1;
  console.log('\nEstados de órdenes:');
  for (const [s, c] of Object.entries(statusCounts)) {
    console.log(`  ${s.padEnd(24)}: ${c}`);
  }
  console.log('');
}

main()
  .then(async () => {
    await closeDb();
    process.exit(0);
  })
  .catch(async (err: unknown) => {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('\nError:', msg);
    if (err instanceof Error && err.stack) console.error(err.stack);
    await closeDb();
    process.exit(1);
  });
