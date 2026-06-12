import 'dotenv/config';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { closeDb, getDb } from './client';
import { insurer, laboratorio, practice, ubValue } from './schema';

async function seed() {
  const db = getDb();

  console.log('Seeding laboratorio (tenant raiz)...');
  const [existingLab] = await db.select().from(laboratorio).limit(1);
  if (!existingLab) {
    await db.insert(laboratorio).values({
      slug: 'lab-santa-fe',
      legalName: 'Laboratorio Bioquimico Santa Fe S.R.L.',
      shortName: 'Lab Santa Fe',
      cuit: '30-00000000-0',
      streetAddress: 'Calle Falsa 123',
      city: 'Santa Fe',
      province: 'Santa Fe',
      phone: '0342-1234567',
      email: 'contacto@laboratorio.test',
      signingProfessionalName: 'Dr. Profesional Firmante',
      signingProfessionalMp: 'MP 0000',
    });
  }

  console.log('Seeding insurers...');
  await db
    .insert(insurer)
    .values([
      {
        code: 'PARTICULAR',
        name: 'Particular',
        requiresAuthorization: false,
        active: true,
      },
      { code: 'IAPOS', name: 'IAPOS', requiresAuthorization: true, active: true },
      { code: 'OSDE', name: 'OSDE', requiresAuthorization: true, active: true },
      { code: 'PAMI', name: 'PAMI', requiresAuthorization: true, active: true },
      {
        code: 'GALENO',
        name: 'Galeno',
        requiresAuthorization: true,
        active: true,
      },
      { code: 'SWISS', name: 'Swiss Medical', requiresAuthorization: true, active: true },
    ])
    .onConflictDoNothing();

  console.log('Seeding practices (catalogo minimo)...');
  const practiceRows = [
      {
        nbuCode: '0301',
        name: 'Glucemia',
        shortName: 'Glucosa',
        category: 'Quimica clinica',
        section: 'quimica',
        units: '1.50',
        isSpecialAct: false,
        active: true,
        referenceValueTemplate: {
          defaultUnit: 'mg/dL',
          methodology: 'Glucosa oxidasa',
          rules: [
            {
              band: { low: '70', high: '110', criticalLow: '40', criticalHigh: '500' },
            },
          ],
        },
      },
      {
        nbuCode: '0501',
        name: 'Hemograma completo',
        shortName: 'Hemograma',
        category: 'Hematologia',
        section: 'hematologia',
        units: '5.00',
        isSpecialAct: false,
        active: true,
      },
      {
        nbuCode: '0902',
        name: 'Colesterol total',
        shortName: 'Colesterol',
        category: 'Quimica clinica',
        section: 'quimica',
        units: '2.00',
        isSpecialAct: false,
        active: true,
        referenceValueTemplate: {
          defaultUnit: 'mg/dL',
          rules: [
            { band: { low: '0', high: '200', criticalHigh: '300' } },
          ],
        },
      },
      {
        nbuCode: '8801',
        name: 'Prueba de sobrecarga de glucosa (P75)',
        shortName: 'Sobrecarga glucosa',
        category: 'Quimica clinica',
        section: 'quimica',
        units: '3.00',
        isSpecialAct: true,
        active: true,
      },
    ];
  await db
    .insert(practice)
    .values(practiceRows)
    .onConflictDoUpdate({
      target: practice.nbuCode,
      set: {
        referenceValueTemplate: sql`EXCLUDED.reference_value_template`,
        name: sql`EXCLUDED.name`,
        shortName: sql`EXCLUDED.short_name`,
        category: sql`EXCLUDED.category`,
        section: sql`EXCLUDED.section`,
        units: sql`EXCLUDED.units`,
        isSpecialAct: sql`EXCLUDED.is_special_act`,
        updatedAt: new Date(),
      },
    });

  console.log('Seeding UB vigente para PARTICULAR (si no existe)...');
  const [particular] = await db
    .select()
    .from(insurer)
    .where(eq(insurer.code, 'PARTICULAR'))
    .limit(1);
  if (particular) {
    const [openUb] = await db
      .select()
      .from(ubValue)
      .where(and(eq(ubValue.insurerId, particular.id), isNull(ubValue.validTo)))
      .limit(1);
    if (!openUb) {
      await db.insert(ubValue).values({
        insurerId: particular.id,
        validFrom: new Date('2026-01-01'),
        value: '2000.00',
        notes: 'UB inicial seed',
      });
    }
  }

  const counts = await db.execute(sql`
    SELECT
      (SELECT count(*) FROM laboratorio)             AS laboratorio,
      (SELECT count(*) FROM insurer)                 AS insurer,
      (SELECT count(*) FROM practice)                AS practice,
      (SELECT count(*) FROM ub_value)                AS ub_value
  `);
  console.log('Seed summary:', counts[0]);
}

seed()
  .then(async () => {
    await closeDb();
    console.log('Seed completed successfully.');
    process.exit(0);
  })
  .catch(async (err) => {
    console.error('Seed failed:', err);
    await closeDb();
    process.exit(1);
  });
