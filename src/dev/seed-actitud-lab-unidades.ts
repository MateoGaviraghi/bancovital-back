/**
 * Seed script: carga unidades de medida y las asocia a prácticas para "Actitud+ Lab".
 *
 * Uso:
 *   LAB_SLUG=mi-lab pnpm exec ts-node -r tsconfig-paths/register src/dev/seed-actitud-lab-unidades.ts
 *   (Si no se especifica LAB_SLUG, usa el primer laboratorio encontrado.)
 *
 * Idempotente: se puede ejecutar múltiples veces sin efectos secundarios.
 * Nuevas prácticas (Espermocultivo, Frotis de SP, Exudado de Fauces) se crean si no existen.
 */
import 'dotenv/config';
import { closeDb, getDb } from '@/db/client';
import {
  laboratorio,
  practice,
  practiceUnidad,
  unidadMedida,
} from '@/db/schema';
import { and, eq, sql } from 'drizzle-orm';

const LAB_SLUG = process.env.LAB_SLUG;

// ─── tipos utilitarios ────────────────────────────────────────────────────────

interface UnidadDef {
  nombre: string;
  simbolo?: string;
  opciones?: string[];
}

interface AssocDef {
  practiceNbuCode: string;
  unidadNombre: string;
  sortOrder: number;
  rangeLow?: string;
  rangeHigh?: string;
  referenceText?: string;
}

// ─── Opciones reutilizables ────────────────────────────────────────────────────

const CRUCES = ['No contiene', '+', '++', '+++'];
const CRUCES_4 = ['+', '++', '+++', '++++'];
const ERA = ['Escasos (E)', 'Regulares (R)', 'Abundantes (A)'];
const SIR = ['S', 'I', 'R'];

// ─── PRÁCTICAS A CREAR SI NO EXISTEN ──────────────────────────────────────────

const CUSTOM_PRACTICES = [
  {
    nbuCode: 'ACT-ESPERMOCULTIVO',
    name: 'Espermocultivo',
    shortName: 'Espermocultivo',
    category: 'Microbiología',
    section: 'microbiologia',
    units: '5.00',
    isElaborated: true,
    isSpecialAct: false,
    active: true,
  },
  {
    nbuCode: 'ACT-FROTIS-SP',
    name: 'Frotis de sangre periférica',
    shortName: 'Frotis SP',
    category: 'Hematología',
    section: 'hematologia',
    units: '3.00',
    isElaborated: true,
    isSpecialAct: false,
    active: true,
  },
  {
    nbuCode: 'ACT-EXUDADO-FAUCES',
    name: 'Exudado de fauces (Cultivo)',
    shortName: 'Exud. fauces',
    category: 'Microbiología',
    section: 'microbiologia',
    units: '3.00',
    isElaborated: true,
    isSpecialAct: false,
    active: true,
  },
] as const;

// ─── CATÁLOGO DE UNIDADES DE MEDIDA ───────────────────────────────────────────

const UNIDADES: UnidadDef[] = [
  // ── Fisicoquímico (orina) ──────────────────────────────────────────────────
  {
    nombre: 'Color (orina)',
    opciones: ['Amarillo claro', 'Amarillo ámbar', 'Amarillo oscuro', 'Rojizo', 'Rojo oscuro', 'Marrón'],
  },
  {
    nombre: 'Aspecto (orina)',
    opciones: ['Límpido', 'Ligeramente turbio', 'Turbio'],
  },
  {
    nombre: 'pH (orina)',
    opciones: ['5', '6', '7', '8', '9'],
  },
  {
    nombre: 'Densidad (orina)',
    opciones: ['1000', '1005', '1010', '1020', '1025', '1030'],
  },
  {
    nombre: 'Nitritos',
    opciones: ['No contiene', 'Contiene (+)'],
  },
  {
    nombre: 'Glucosa (orina)',
    opciones: ['No contiene', 'Contiene (+)', 'Contiene (++)'],
  },
  {
    nombre: 'Proteínas (orina)',
    opciones: CRUCES_4,
  },
  {
    nombre: 'Bilirrubina (orina)',
    opciones: CRUCES,
  },
  {
    nombre: 'Hemoglobina (orina)',
    opciones: CRUCES,
  },
  {
    nombre: 'Cetonas (orina)',
    opciones: CRUCES,
  },
  {
    nombre: 'Urobilinógeno',
    opciones: ['Normal', '+', '++', '+++'],
  },

  // ── Microscópico orina ─────────────────────────────────────────────────────
  {
    nombre: 'Leucocitos (sedimento)',
    simbolo: 'c/cpo',
    opciones: ['0-1', '1-3', '4-5', '5-7', '7-9', '10-15', '15-20', '>20', 'Campo cubierto'],
  },
  {
    nombre: 'Hematíes (sedimento)',
    simbolo: 'c/cpo',
    opciones: ['0-2', '3-5', '6-10', '10-20', '>20', 'Campo cubierto'],
  },
  {
    nombre: 'Células epiteliales (orina)',
    opciones: ERA,
  },
  {
    nombre: 'Cilindros',
    // texto libre: tipo (Hialinos/Granulosos/Eritrocitarios/Leucocitarios) + cantidad (E/R/A)
    // Se usa campo de texto para permitir múltiples tipos
  },
  {
    nombre: 'Piocitos',
    opciones: ERA,
  },
  {
    nombre: 'Cristales',
    // texto libre — multi-tipo; ver sección 4 del prompt
  },

  // ── Cultivo (urocultivo) ───────────────────────────────────────────────────
  {
    nombre: 'Cultivo (urocultivo)',
    opciones: [
      'Negativo. No se observó desarrollo bacteriano significativo luego de 24/48 horas de incubación.',
      'Desarrollo bacteriano significativo.',
    ],
  },
  {
    nombre: 'Microorganismo aislado (urocultivo)',
    opciones: [
      'Escherichia coli',
      'Klebsiella pneumoniae',
      'Klebsiella oxytoca',
      'Proteus mirabilis',
      'Proteus vulgaris',
      'Morganella morganii',
      'Citrobacter freundii',
      'Enterobacter cloacae',
      'Serratia marcescens',
      'Pseudomonas aeruginosa',
      'Acinetobacter baumannii',
      'Enterococcus faecalis',
      'Enterococcus faecium',
      'Staphylococcus aureus',
      'Staphylococcus saprophyticus',
      'Streptococcus agalactiae',
      'Candida albicans',
      'Candida tropicalis',
      'Candida glabrata',
    ],
  },
  {
    nombre: 'Recuento UFC',
    simbolo: 'UFC/mL',
    opciones: ['<10.000 UFC/mL', '10.000–100.000 UFC/mL', '>100.000 UFC/mL'],
  },
  {
    nombre: 'Resultado predefinido (urocultivo)',
    opciones: [
      'Sin desarrollo bacteriano.',
      'Desarrollo de microbiota mixta compatible con contaminación.',
      'Desarrollo polimicrobiano. Se sugiere repetir muestra.',
      'Desarrollo de levaduras compatibles con Candida spp.',
      'Recuento no significativo (<10.000 UFC/mL).',
      'Desarrollo bacteriano significativo (>100.000 UFC/mL).',
      'Muestra inadecuada para procesamiento.',
    ],
  },

  // ── Antibiograma — Amplio (urocultivo) ─────────────────────────────────────
  { nombre: 'Ampicilina', opciones: SIR },
  { nombre: 'Amoxicilina/Clavulánico', opciones: SIR },
  { nombre: 'Piperacilina/Tazobactam', opciones: SIR },
  { nombre: 'Cefazolina', opciones: SIR },
  { nombre: 'Cefuroxima', opciones: SIR },
  { nombre: 'Cefotaxima', opciones: SIR },
  { nombre: 'Ceftriaxona', opciones: SIR },
  { nombre: 'Ceftazidima', opciones: SIR },
  { nombre: 'Cefepime', opciones: SIR },
  { nombre: 'Aztreonam', opciones: SIR },
  { nombre: 'Ertapenem', opciones: SIR },
  { nombre: 'Imipenem', opciones: SIR },
  { nombre: 'Meropenem', opciones: SIR },
  { nombre: 'Amikacina', opciones: SIR },
  { nombre: 'Gentamicina', opciones: SIR },
  { nombre: 'Tobramicina', opciones: SIR },
  { nombre: 'Ciprofloxacina', opciones: SIR },
  { nombre: 'Levofloxacina', opciones: SIR },
  { nombre: 'Trimetoprima/Sulfametoxazol', opciones: SIR },
  { nombre: 'Nitrofurantoína', opciones: SIR },
  { nombre: 'Fosfomicina', opciones: SIR },
  // Adicionales para coprocultivo
  { nombre: 'Azitromicina', opciones: SIR },
  { nombre: 'Cloranfenicol', opciones: SIR },
  // Adicionales para espermocultivo
  { nombre: 'Vancomicina', opciones: SIR },
  // Adicionales para SGB
  { nombre: 'Penicilina', opciones: SIR },
  { nombre: 'Eritromicina', opciones: SIR },
  { nombre: 'Clindamicina', opciones: SIR },

  // ── COPROCULTIVO ───────────────────────────────────────────────────────────
  {
    nombre: 'Leucocitos fecales',
    simbolo: 'c/cpo',
  },
  {
    nombre: 'Hematíes (copro)',
    simbolo: 'c/cpo',
  },
  {
    nombre: 'Levaduras (copro)',
  },
  {
    nombre: 'Parásitos observados (copro)',
  },
  {
    nombre: 'Otros hallazgos (copro)',
  },
  {
    nombre: 'Cultivo (coprocultivo)',
    opciones: [
      'Negativo para enteropatógenos.',
      'Desarrollo de microorganismo enteropatógeno.',
    ],
  },
  {
    nombre: 'Microorganismo aislado (coprocultivo)',
    opciones: [
      'Salmonella spp.',
      'Salmonella enterica',
      'Shigella spp.',
      'Shigella sonnei',
      'Shigella flexneri',
      'Aeromonas spp.',
      'Plesiomonas shigelloides',
      'Vibrio spp.',
      'Vibrio cholerae',
      'Campylobacter jejuni',
      'Campylobacter coli',
      'Yersinia enterocolitica',
      'Escherichia coli enteropatógena',
    ],
  },
  {
    nombre: 'Desarrollo (cultivo)',
    opciones: ['Escaso', 'Moderado', 'Abundante'],
  },
  {
    nombre: 'Resultado predefinido (coprocultivo)',
    opciones: [
      '< 5 PMN / campo 40X',
      '> 30 PMN / campo 40X',
      'Negativo para Salmonella spp. y Shigella spp.',
      'Negativo para enteropatógenos investigados.',
      'Desarrollo de microbiota intestinal habitual.',
      'No se aislaron enteropatógenos.',
      'Desarrollo de Salmonella spp.',
      'Desarrollo de Shigella spp.',
      'Desarrollo de Aeromonas spp.',
      'Desarrollo de Campylobacter spp.',
      'Desarrollo de flora bacteriana habitual.',
    ],
  },

  // ── ESTUDIO MICOLÓGICO ─────────────────────────────────────────────────────
  {
    nombre: 'Preparación (micológico)',
    opciones: ['KOH', 'KOH + Tinta', 'Blanco de Calcoflúor', 'Otro'],
  },
  {
    nombre: 'Examen directo (micológico)',
    opciones: ['Negativo para elementos micóticos', 'Positivo para elementos micóticos'],
  },
  {
    nombre: 'Hallazgos directos (micológico)',
    // texto libre para multi-selección: Hifas hialinas septadas / no septadas / Artroconidias / etc.
  },
  {
    nombre: 'Cultivo micológico (días)',
    simbolo: 'días',
    // texto libre numérico
  },
  {
    nombre: 'Cultivo micológico (resultado)',
    opciones: ['Negativo', 'Desarrollo fúngico'],
  },
  {
    nombre: 'Microorganismo aislado (micológico)',
    opciones: [
      // Dermatofitos
      'Trichophyton rubrum',
      'Trichophyton mentagrophytes',
      'Trichophyton interdigitale',
      'Trichophyton tonsurans',
      'Trichophyton verrucosum',
      'Microsporum canis',
      'Microsporum gypseum',
      'Epidermophyton floccosum',
      // Levaduras
      'Candida albicans',
      'Candida tropicalis',
      'Candida glabrata',
      'Candida parapsilosis',
      'Candida krusei',
      'Candida auris',
      'Rhodotorula spp.',
      'Cryptococcus spp.',
      // Mohos
      'Aspergillus fumigatus',
      'Aspergillus flavus',
      'Aspergillus niger',
      'Fusarium spp.',
      'Scopulariopsis spp.',
      'Acremonium spp.',
    ],
  },
  {
    nombre: 'Cantidad (micológico)',
    opciones: ['Escaso', 'Moderado', 'Abundante'],
  },
  {
    nombre: 'Resultado predefinido (micológico)',
    opciones: [
      'Negativo para elementos micóticos.',
      'Negativo para dermatofitos.',
      'Desarrollo de dermatofito.',
      'Desarrollo de levaduras del género Candida.',
      'Desarrollo de moho ambiental. Correlacionar con cuadro clínico.',
      'Desarrollo de flora fúngica saprofita.',
      'Cultivo contaminado. Se recomienda nueva muestra.',
    ],
  },

  // ── COPROPARASITOLÓGICO ────────────────────────────────────────────────────
  {
    nombre: 'Método (parasitológico)',
    opciones: ['Examen directo', 'Concentración', 'Faust', 'Ritchie', 'Willis', 'Kato-Katz', 'Otro'],
  },
  { nombre: 'Color (materia fecal)' },
  { nombre: 'Consistencia' },
  { nombre: 'Moco' },
  { nombre: 'Sangre visible' },
  { nombre: 'Parásitos adultos observados' },
  {
    nombre: 'Protozoarios',
    opciones: [
      'No observados',
      'Quistes de Giardia duodenalis (lamblia)',
      'Quistes de Entamoeba histolytica',
      'Quistes de Blastocystis spp.',
      'Quistes de Dientamoeba fragilis',
      'Quistes de Cryptosporidium spp.',
      'Quistes de Cyclospora cayetanensis',
      'Quistes de Cystoisospora belli',
      'Quistes de Entamoeba coli (comensal)',
      'Quistes de Endolimax nana (comensal)',
      'Quistes de Iodamoeba bütschlii (comensal)',
      'Trofozoítos de Giardia duodenalis',
      'Trofozoítos de Entamoeba histolytica',
    ],
  },
  {
    nombre: 'Helmintos',
    opciones: [
      'No observados',
      'Huevos de Enterobius vermicularis',
      'Huevos de Ascaris lumbricoides',
      'Huevos de Trichuris trichiura',
      'Huevos de Ancylostoma duodenale',
      'Huevos de Necator americanus',
      'Larvas de Strongyloides stercoralis',
      'Huevos de Taenia spp.',
      'Huevos de Hymenolepis nana',
      'Huevos de Fasciola hepatica',
    ],
  },
  {
    nombre: 'Levaduras (parasitológico)',
  },
  {
    nombre: 'Otros hallazgos (parasitológico)',
  },
  {
    nombre: 'Resultado predefinido (parasitológico)',
    opciones: [
      'Negativo para formas parasitarias.',
      'No se observaron protozoarios ni helmintos.',
      'Se observaron quistes de Giardia duodenalis.',
      'Se observaron quistes de Blastocystis spp.',
      'Se observaron huevos de Enterobius vermicularis.',
      'Se observaron huevos de Ascaris lumbricoides.',
      'Se observaron formas compatibles con Entamoeba coli (comensal intestinal).',
      'Se observaron levaduras en cantidad escasa/moderada/abundante.',
    ],
  },

  // ── ESPERMOCULTIVO ─────────────────────────────────────────────────────────
  { nombre: 'Leucocitos (esperma)', simbolo: 'c/cpo' },
  { nombre: 'Hematíes (esperma)', simbolo: 'c/cpo' },
  { nombre: 'Células epiteliales (esperma)' },
  { nombre: 'Bacterias (esperma)' },
  { nombre: 'Levaduras (esperma)' },
  { nombre: 'Otros hallazgos (esperma)' },
  {
    nombre: 'Cultivo (espermocultivo)',
    opciones: [
      'Negativo. No se observó desarrollo microbiano significativo luego de 24/48 horas de incubación.',
      'Desarrollo microbiano.',
    ],
  },
  {
    nombre: 'Microorganismo aislado (espermocultivo)',
    opciones: [
      'Escherichia coli',
      'Enterococcus faecalis',
      'Enterococcus faecium',
      'Klebsiella pneumoniae',
      'Proteus mirabilis',
      'Pseudomonas aeruginosa',
      'Staphylococcus aureus',
      'Streptococcus agalactiae',
      'Candida albicans',
    ],
  },
  {
    nombre: 'Desarrollo (espermocultivo)',
    opciones: ['Sin desarrollo', 'Escaso', 'Moderado', 'Abundante'],
  },
  { nombre: 'Recuento bacteriano (esperma)', simbolo: 'UFC/mL' },
  {
    nombre: 'Resultado predefinido (espermocultivo)',
    opciones: [
      'No se observó desarrollo microbiano significativo.',
      'Cultivo seminal negativo.',
      'Desarrollo de Escherichia coli.',
      'Desarrollo de Enterococcus faecalis.',
      'Desarrollo de Enterococcus faecium.',
      'Desarrollo de Klebsiella pneumoniae.',
      'Desarrollo de Proteus mirabilis.',
      'Desarrollo de Pseudomonas aeruginosa.',
      'Desarrollo de Staphylococcus aureus.',
      'Desarrollo de Streptococcus agalactiae.',
      'Desarrollo de Candida albicans.',
      'Flora polimicrobiana compatible con contaminación de la muestra.',
      'Desarrollo de microbiota urogenital habitual.',
      'Se recomienda nueva muestra ante sospecha de contaminación.',
    ],
  },

  // ── BÚSQUEDA DE STREPTOCOCCUS GRUPO B ─────────────────────────────────────
  {
    nombre: 'Muestra (SGB)',
    opciones: ['Exudado vaginal', 'Exudado rectal', 'Exudado vaginorrectal', 'Otra'],
  },
  {
    nombre: 'Cultivo (SGB)',
    opciones: [
      'Negativo para Streptococcus agalactiae (Grupo B).',
      'Positivo para Streptococcus agalactiae (Grupo B).',
    ],
  },
  {
    nombre: 'Resultado predefinido (SGB)',
    opciones: [
      'Negativo para Streptococcus agalactiae (Grupo B).',
      'No se aisló Streptococcus agalactiae.',
      'Positivo para Streptococcus agalactiae (Grupo B).',
      'Se aisló Streptococcus agalactiae.',
    ],
  },
  {
    nombre: 'Observaciones (SGB)',
    opciones: [
      'La colonización materna por Streptococcus agalactiae constituye un factor de riesgo para infección neonatal.',
      'Correlacionar con criterio obstétrico para profilaxis intraparto.',
      'Estudio realizado según recomendaciones para tamizaje prenatal entre las semanas 35 y 37 de gestación.',
    ],
  },

  // ── FROTIS DE SANGRE PERIFÉRICA ───────────────────────────────────────────
  {
    nombre: 'Calidad de la muestra (FSP)',
    opciones: ['Adecuada para evaluación morfológica', 'Regular', 'No adecuada'],
  },
  // Serie roja
  {
    nombre: 'Tamaño eritrocitario',
    opciones: ['Normocitosis', 'Microcitosis', 'Macrocitosis', 'Dimorfismo eritrocitario'],
  },
  {
    nombre: 'Variación de tamaño eritrocitario',
    opciones: ['Sin alteraciones', 'Anisocitosis leve', 'Anisocitosis moderada', 'Anisocitosis marcada'],
  },
  {
    nombre: 'Coloración eritrocitaria',
    opciones: ['Normocromía', 'Hipocromía', 'Hipercromía'],
  },
  {
    nombre: 'Forma eritrocitaria',
    // texto libre — multi-selección de: Poiquilocitosis + Ovalocitos, Eliptocitos, Dianocitos, etc.
  },
  {
    nombre: 'Inclusiones eritrocitarias',
    opciones: [
      'No observadas',
      'Cuerpos de Howell-Jolly',
      'Punteado basófilo',
      'Cuerpos de Heinz',
      'Anillos de Cabot',
      'Otros',
    ],
  },
  // Serie blanca
  {
    nombre: 'Neutrófilos',
    opciones: [
      'Morfología conservada',
      'Granulaciones tóxicas',
      'Vacuolización citoplasmática',
      'Cuerpos de Döhle',
      'Hipersegmentación',
      'Hiposegmentación',
      'Desviación a izquierda',
    ],
  },
  {
    nombre: 'Linfocitos',
    opciones: ['Morfología conservada', 'Linfocitos reactivos', 'Linfocitos atípicos', 'Otros'],
  },
  {
    nombre: 'Monocitos',
    opciones: ['Morfología conservada', 'Alteraciones observadas'],
  },
  {
    nombre: 'Eosinófilos',
    opciones: ['Morfología conservada', 'Alteraciones observadas'],
  },
  {
    nombre: 'Basófilos',
    opciones: ['Morfología conservada', 'Alteraciones observadas'],
  },
  {
    nombre: 'Elementos inmaduros',
    opciones: ['No observados', 'Mielocitos', 'Metamielocitos', 'Promielocitos', 'Blastos', 'Otros'],
  },
  // Serie plaquetaria
  {
    nombre: 'Cantidad plaquetaria',
    opciones: ['Adecuada', 'Disminuida', 'Aumentada'],
  },
  {
    nombre: 'Morfología plaquetaria',
    opciones: ['Conservada', 'Plaquetas gigantes', 'Macroplaquetas', 'Microplaquetas', 'Agregados plaquetarios'],
  },
  {
    nombre: 'Hemoparásitos',
    opciones: [
      'No observados',
      'Formas compatibles con Babesia spp.',
      'Formas compatibles con Mycoplasma spp.',
      'Formas compatibles con Ehrlichia spp.',
      'Formas compatibles con Anaplasma spp.',
      'Formas compatibles con Hepatozoon spp.',
      'Otros',
    ],
  },
  {
    nombre: 'Resultado predefinido (FSP)',
    opciones: [
      'Morfología eritrocitaria conservada.',
      'Morfología leucocitaria conservada.',
      'Plaquetas adecuadas en número y morfología.',
      'No se observaron alteraciones morfológicas significativas.',
      'Se observan cambios reactivos compatibles con proceso inflamatorio.',
      'Se observan elementos inmaduros de la serie mieloide.',
      'Se observan linfocitos reactivos.',
    ],
  },

  // ── EXUDADO VAGINAL / EVB (BACOVA) ─────────────────────────────────────────
  {
    nombre: 'Cantidad (EVB)',
  },
  {
    nombre: 'Color (EVB)',
  },
  {
    nombre: 'Aspecto (EVB)',
  },
  {
    nombre: 'pH (EVB)',
    simbolo: 'pH',
  },
  {
    nombre: 'Test de aminas',
    opciones: ['Positivo', 'Negativo'],
  },
  {
    nombre: 'Trichomonas vaginalis',
    opciones: ['No se observan', 'Se observan'],
  },
  {
    nombre: 'Levaduras y/o pseudohifas',
    opciones: ['No se observan', 'Se observan'],
  },
  {
    nombre: 'Morfotipos bacterianos extraños',
    opciones: ['No se observan', 'Se observan bacilos Gram (-) y cocos Gram (+)'],
  },
  {
    nombre: 'RIV (Reacción inflamatoria vaginal)',
    opciones: ['Sí', 'No'],
  },
  {
    nombre: 'Células guía',
    opciones: ['Sí', 'No'],
  },
  {
    nombre: 'Valor numérico RIV',
    simbolo: 'corregido',
  },
  {
    nombre: 'EVB (diagnóstico)',
    opciones: [
      'EVB I — Microbiota habitual',
      'EVB II — Microbiota habitual + RIV',
      'EVB III — Microbiota intermedia',
      'EVB IV — Vaginosis bacteriana',
      'EVB V — Vaginitis microbiana inespecífica',
    ],
  },
  {
    nombre: 'Observaciones EVB',
  },
  {
    nombre: 'Cultivo (EVB)',
    opciones: [
      'No se observa desarrollo de Complejo Candida albicans/dubliniensis/africana.',
      'Se observa desarrollo de Complejo Candida albicans/dubliniensis/africana.',
    ],
  },
  {
    nombre: 'Conclusión (EVB)',
  },

  // ── ESPUTO / BACILOSCOPÍA (BAAR) ──────────────────────────────────────────
  {
    nombre: 'Células epiteliales (esputo)',
    opciones: ['< 10 cél/100x', '> 10 cél/100x'],
  },
  {
    nombre: 'Leucocitos (esputo)',
    opciones: ['> 25 leucocitos/campo (100x)', '< 25 leucocitos/campo (100x)'],
  },
  {
    nombre: 'Gram (esputo)',
    // texto libre — multi-selección de morfotipos
  },
  {
    nombre: 'BAAR (baciloscopía)',
    opciones: [
      'No se observa BAAR',
      'Positivo (+) — < 1 BAAR / 100 campos',
      'Positivo (++) — 1–10 BAAR / 50 campos',
      'Positivo (+++) — más de 10 BAAR / 20 campos',
    ],
  },

  // ── EXUDADO DE FAUCES ──────────────────────────────────────────────────────
  {
    nombre: 'Microscópico (fauces)',
    opciones: ['Asociación fusoespirilar', 'Elementos levaduriformes'],
    // sin valor por defecto — campo opcional
  },
  {
    nombre: 'Cultivo (fauces)',
    opciones: [
      'Streptococcus grupo A',
      'Streptococcus grupo C',
      'Streptococcus grupo G',
      'Arcanobacterium haemolyticum',
      'Desarrollo de microbiota habitual de vías respiratorias superiores',
    ],
  },
];

// ─── ASOCIACIONES práctica ↔ unidades ─────────────────────────────────────────

const ASOCIACIONES: AssocDef[] = [
  // ══════════════════════════════════════════════════════════════════
  // UROCULTIVO (NBU: 660911)
  // ══════════════════════════════════════════════════════════════════
  // Fisicoquímico
  { practiceNbuCode: '660911', unidadNombre: 'Color (orina)', sortOrder: 10 },
  { practiceNbuCode: '660911', unidadNombre: 'Aspecto (orina)', sortOrder: 20 },
  { practiceNbuCode: '660911', unidadNombre: 'pH (orina)', sortOrder: 30 },
  { practiceNbuCode: '660911', unidadNombre: 'Densidad (orina)', sortOrder: 40 },
  { practiceNbuCode: '660911', unidadNombre: 'Nitritos', sortOrder: 50 },
  { practiceNbuCode: '660911', unidadNombre: 'Glucosa (orina)', sortOrder: 60 },
  { practiceNbuCode: '660911', unidadNombre: 'Proteínas (orina)', sortOrder: 70 },
  { practiceNbuCode: '660911', unidadNombre: 'Bilirrubina (orina)', sortOrder: 80 },
  { practiceNbuCode: '660911', unidadNombre: 'Hemoglobina (orina)', sortOrder: 90 },
  { practiceNbuCode: '660911', unidadNombre: 'Cetonas (orina)', sortOrder: 100 },
  { practiceNbuCode: '660911', unidadNombre: 'Urobilinógeno', sortOrder: 110 },
  // Microscópico
  { practiceNbuCode: '660911', unidadNombre: 'Leucocitos (sedimento)', sortOrder: 200 },
  { practiceNbuCode: '660911', unidadNombre: 'Hematíes (sedimento)', sortOrder: 210 },
  { practiceNbuCode: '660911', unidadNombre: 'Células epiteliales (orina)', sortOrder: 220 },
  { practiceNbuCode: '660911', unidadNombre: 'Cilindros', sortOrder: 230 },
  { practiceNbuCode: '660911', unidadNombre: 'Piocitos', sortOrder: 240 },
  { practiceNbuCode: '660911', unidadNombre: 'Cristales', sortOrder: 250 },
  // Cultivo
  { practiceNbuCode: '660911', unidadNombre: 'Cultivo (urocultivo)', sortOrder: 300 },
  { practiceNbuCode: '660911', unidadNombre: 'Microorganismo aislado (urocultivo)', sortOrder: 310 },
  { practiceNbuCode: '660911', unidadNombre: 'Recuento UFC', sortOrder: 320 },
  // Antibiograma
  { practiceNbuCode: '660911', unidadNombre: 'Ampicilina', sortOrder: 400 },
  { practiceNbuCode: '660911', unidadNombre: 'Amoxicilina/Clavulánico', sortOrder: 410 },
  { practiceNbuCode: '660911', unidadNombre: 'Piperacilina/Tazobactam', sortOrder: 420 },
  { practiceNbuCode: '660911', unidadNombre: 'Cefazolina', sortOrder: 430 },
  { practiceNbuCode: '660911', unidadNombre: 'Cefuroxima', sortOrder: 440 },
  { practiceNbuCode: '660911', unidadNombre: 'Cefotaxima', sortOrder: 450 },
  { practiceNbuCode: '660911', unidadNombre: 'Ceftriaxona', sortOrder: 460 },
  { practiceNbuCode: '660911', unidadNombre: 'Ceftazidima', sortOrder: 470 },
  { practiceNbuCode: '660911', unidadNombre: 'Cefepime', sortOrder: 480 },
  { practiceNbuCode: '660911', unidadNombre: 'Aztreonam', sortOrder: 490 },
  { practiceNbuCode: '660911', unidadNombre: 'Ertapenem', sortOrder: 500 },
  { practiceNbuCode: '660911', unidadNombre: 'Imipenem', sortOrder: 510 },
  { practiceNbuCode: '660911', unidadNombre: 'Meropenem', sortOrder: 520 },
  { practiceNbuCode: '660911', unidadNombre: 'Amikacina', sortOrder: 530 },
  { practiceNbuCode: '660911', unidadNombre: 'Gentamicina', sortOrder: 540 },
  { practiceNbuCode: '660911', unidadNombre: 'Tobramicina', sortOrder: 550 },
  { practiceNbuCode: '660911', unidadNombre: 'Ciprofloxacina', sortOrder: 560 },
  { practiceNbuCode: '660911', unidadNombre: 'Levofloxacina', sortOrder: 570 },
  { practiceNbuCode: '660911', unidadNombre: 'Trimetoprima/Sulfametoxazol', sortOrder: 580 },
  { practiceNbuCode: '660911', unidadNombre: 'Nitrofurantoína', sortOrder: 590 },
  { practiceNbuCode: '660911', unidadNombre: 'Fosfomicina', sortOrder: 600 },
  // Predefinidos
  { practiceNbuCode: '660911', unidadNombre: 'Resultado predefinido (urocultivo)', sortOrder: 700 },

  // ══════════════════════════════════════════════════════════════════
  // COPROCULTIVO (NBU: 660187)
  // ══════════════════════════════════════════════════════════════════
  { practiceNbuCode: '660187', unidadNombre: 'Leucocitos fecales', sortOrder: 100 },
  { practiceNbuCode: '660187', unidadNombre: 'Hematíes (copro)', sortOrder: 110 },
  { practiceNbuCode: '660187', unidadNombre: 'Levaduras (copro)', sortOrder: 120 },
  { practiceNbuCode: '660187', unidadNombre: 'Parásitos observados (copro)', sortOrder: 130 },
  { practiceNbuCode: '660187', unidadNombre: 'Otros hallazgos (copro)', sortOrder: 140 },
  { practiceNbuCode: '660187', unidadNombre: 'Cultivo (coprocultivo)', sortOrder: 200 },
  { practiceNbuCode: '660187', unidadNombre: 'Microorganismo aislado (coprocultivo)', sortOrder: 210 },
  { practiceNbuCode: '660187', unidadNombre: 'Desarrollo (cultivo)', sortOrder: 220 },
  // Antibiograma (coprocultivo subset)
  { practiceNbuCode: '660187', unidadNombre: 'Ampicilina', sortOrder: 300 },
  { practiceNbuCode: '660187', unidadNombre: 'Amoxicilina/Clavulánico', sortOrder: 310 },
  { practiceNbuCode: '660187', unidadNombre: 'Cefotaxima', sortOrder: 320 },
  { practiceNbuCode: '660187', unidadNombre: 'Ceftriaxona', sortOrder: 330 },
  { practiceNbuCode: '660187', unidadNombre: 'Ceftazidima', sortOrder: 340 },
  { practiceNbuCode: '660187', unidadNombre: 'Ciprofloxacina', sortOrder: 350 },
  { practiceNbuCode: '660187', unidadNombre: 'Trimetoprima/Sulfametoxazol', sortOrder: 360 },
  { practiceNbuCode: '660187', unidadNombre: 'Azitromicina', sortOrder: 370 },
  { practiceNbuCode: '660187', unidadNombre: 'Cloranfenicol', sortOrder: 380 },
  // Predefinidos
  { practiceNbuCode: '660187', unidadNombre: 'Resultado predefinido (coprocultivo)', sortOrder: 500 },

  // ══════════════════════════════════════════════════════════════════
  // ESTUDIO MICOLÓGICO (NBU: 660665)
  // ══════════════════════════════════════════════════════════════════
  { practiceNbuCode: '660665', unidadNombre: 'Preparación (micológico)', sortOrder: 100 },
  { practiceNbuCode: '660665', unidadNombre: 'Examen directo (micológico)', sortOrder: 110 },
  { practiceNbuCode: '660665', unidadNombre: 'Hallazgos directos (micológico)', sortOrder: 120 },
  { practiceNbuCode: '660665', unidadNombre: 'Cultivo micológico (días)', sortOrder: 200 },
  { practiceNbuCode: '660665', unidadNombre: 'Cultivo micológico (resultado)', sortOrder: 210 },
  { practiceNbuCode: '660665', unidadNombre: 'Microorganismo aislado (micológico)', sortOrder: 220 },
  { practiceNbuCode: '660665', unidadNombre: 'Cantidad (micológico)', sortOrder: 230 },
  { practiceNbuCode: '660665', unidadNombre: 'Resultado predefinido (micológico)', sortOrder: 300 },

  // ══════════════════════════════════════════════════════════════════
  // COPROPARASITOLÓGICO (NBU: 660736)
  // ══════════════════════════════════════════════════════════════════
  { practiceNbuCode: '660736', unidadNombre: 'Método (parasitológico)', sortOrder: 10 },
  // Macroscópico
  { practiceNbuCode: '660736', unidadNombre: 'Color (materia fecal)', sortOrder: 100 },
  { practiceNbuCode: '660736', unidadNombre: 'Consistencia', sortOrder: 110 },
  { practiceNbuCode: '660736', unidadNombre: 'Moco', sortOrder: 120 },
  { practiceNbuCode: '660736', unidadNombre: 'Sangre visible', sortOrder: 130 },
  { practiceNbuCode: '660736', unidadNombre: 'Parásitos adultos observados', sortOrder: 140 },
  // Microscópico
  { practiceNbuCode: '660736', unidadNombre: 'Protozoarios', sortOrder: 200 },
  { practiceNbuCode: '660736', unidadNombre: 'Helmintos', sortOrder: 210 },
  { practiceNbuCode: '660736', unidadNombre: 'Levaduras (parasitológico)', sortOrder: 220 },
  { practiceNbuCode: '660736', unidadNombre: 'Otros hallazgos (parasitológico)', sortOrder: 230 },
  // Predefinidos
  { practiceNbuCode: '660736', unidadNombre: 'Resultado predefinido (parasitológico)', sortOrder: 300 },

  // ══════════════════════════════════════════════════════════════════
  // ESPERMOCULTIVO (custom: ACT-ESPERMOCULTIVO)
  // ══════════════════════════════════════════════════════════════════
  { practiceNbuCode: 'ACT-ESPERMOCULTIVO', unidadNombre: 'Leucocitos (esperma)', sortOrder: 100 },
  { practiceNbuCode: 'ACT-ESPERMOCULTIVO', unidadNombre: 'Hematíes (esperma)', sortOrder: 110 },
  { practiceNbuCode: 'ACT-ESPERMOCULTIVO', unidadNombre: 'Células epiteliales (esperma)', sortOrder: 120 },
  { practiceNbuCode: 'ACT-ESPERMOCULTIVO', unidadNombre: 'Bacterias (esperma)', sortOrder: 130 },
  { practiceNbuCode: 'ACT-ESPERMOCULTIVO', unidadNombre: 'Levaduras (esperma)', sortOrder: 140 },
  { practiceNbuCode: 'ACT-ESPERMOCULTIVO', unidadNombre: 'Otros hallazgos (esperma)', sortOrder: 150 },
  { practiceNbuCode: 'ACT-ESPERMOCULTIVO', unidadNombre: 'Cultivo (espermocultivo)', sortOrder: 200 },
  { practiceNbuCode: 'ACT-ESPERMOCULTIVO', unidadNombre: 'Microorganismo aislado (espermocultivo)', sortOrder: 210 },
  { practiceNbuCode: 'ACT-ESPERMOCULTIVO', unidadNombre: 'Desarrollo (espermocultivo)', sortOrder: 220 },
  { practiceNbuCode: 'ACT-ESPERMOCULTIVO', unidadNombre: 'Recuento bacteriano (esperma)', sortOrder: 230 },
  // Antibiograma (espermocultivo)
  { practiceNbuCode: 'ACT-ESPERMOCULTIVO', unidadNombre: 'Ampicilina', sortOrder: 300 },
  { practiceNbuCode: 'ACT-ESPERMOCULTIVO', unidadNombre: 'Amoxicilina/Clavulánico', sortOrder: 310 },
  { practiceNbuCode: 'ACT-ESPERMOCULTIVO', unidadNombre: 'Piperacilina/Tazobactam', sortOrder: 320 },
  { practiceNbuCode: 'ACT-ESPERMOCULTIVO', unidadNombre: 'Cefotaxima', sortOrder: 330 },
  { practiceNbuCode: 'ACT-ESPERMOCULTIVO', unidadNombre: 'Ceftriaxona', sortOrder: 340 },
  { practiceNbuCode: 'ACT-ESPERMOCULTIVO', unidadNombre: 'Ceftazidima', sortOrder: 350 },
  { practiceNbuCode: 'ACT-ESPERMOCULTIVO', unidadNombre: 'Cefepime', sortOrder: 360 },
  { practiceNbuCode: 'ACT-ESPERMOCULTIVO', unidadNombre: 'Imipenem', sortOrder: 370 },
  { practiceNbuCode: 'ACT-ESPERMOCULTIVO', unidadNombre: 'Meropenem', sortOrder: 380 },
  { practiceNbuCode: 'ACT-ESPERMOCULTIVO', unidadNombre: 'Gentamicina', sortOrder: 390 },
  { practiceNbuCode: 'ACT-ESPERMOCULTIVO', unidadNombre: 'Amikacina', sortOrder: 400 },
  { practiceNbuCode: 'ACT-ESPERMOCULTIVO', unidadNombre: 'Ciprofloxacina', sortOrder: 410 },
  { practiceNbuCode: 'ACT-ESPERMOCULTIVO', unidadNombre: 'Levofloxacina', sortOrder: 420 },
  { practiceNbuCode: 'ACT-ESPERMOCULTIVO', unidadNombre: 'Trimetoprima/Sulfametoxazol', sortOrder: 430 },
  { practiceNbuCode: 'ACT-ESPERMOCULTIVO', unidadNombre: 'Nitrofurantoína', sortOrder: 440 },
  { practiceNbuCode: 'ACT-ESPERMOCULTIVO', unidadNombre: 'Fosfomicina', sortOrder: 450 },
  // Predefinidos
  { practiceNbuCode: 'ACT-ESPERMOCULTIVO', unidadNombre: 'Resultado predefinido (espermocultivo)', sortOrder: 500 },

  // ══════════════════════════════════════════════════════════════════
  // BÚSQUEDA DE STREPTOCOCCUS GRUPO B (NBU: 669127)
  // ══════════════════════════════════════════════════════════════════
  { practiceNbuCode: '669127', unidadNombre: 'Muestra (SGB)', sortOrder: 10 },
  { practiceNbuCode: '669127', unidadNombre: 'Cultivo (SGB)', sortOrder: 100 },
  // Antibiograma (SGB subset)
  { practiceNbuCode: '669127', unidadNombre: 'Penicilina', sortOrder: 200 },
  { practiceNbuCode: '669127', unidadNombre: 'Ampicilina', sortOrder: 210 },
  { practiceNbuCode: '669127', unidadNombre: 'Eritromicina', sortOrder: 220 },
  { practiceNbuCode: '669127', unidadNombre: 'Clindamicina', sortOrder: 230 },
  { practiceNbuCode: '669127', unidadNombre: 'Vancomicina', sortOrder: 240 },
  // Predefinidos / observaciones
  { practiceNbuCode: '669127', unidadNombre: 'Resultado predefinido (SGB)', sortOrder: 300 },
  { practiceNbuCode: '669127', unidadNombre: 'Observaciones (SGB)', sortOrder: 310 },

  // ══════════════════════════════════════════════════════════════════
  // FROTIS DE SANGRE PERIFÉRICA (custom: ACT-FROTIS-SP)
  // ══════════════════════════════════════════════════════════════════
  { practiceNbuCode: 'ACT-FROTIS-SP', unidadNombre: 'Calidad de la muestra (FSP)', sortOrder: 10 },
  // Serie roja
  { practiceNbuCode: 'ACT-FROTIS-SP', unidadNombre: 'Tamaño eritrocitario', sortOrder: 100 },
  { practiceNbuCode: 'ACT-FROTIS-SP', unidadNombre: 'Variación de tamaño eritrocitario', sortOrder: 110 },
  { practiceNbuCode: 'ACT-FROTIS-SP', unidadNombre: 'Coloración eritrocitaria', sortOrder: 120 },
  { practiceNbuCode: 'ACT-FROTIS-SP', unidadNombre: 'Forma eritrocitaria', sortOrder: 130 },
  { practiceNbuCode: 'ACT-FROTIS-SP', unidadNombre: 'Inclusiones eritrocitarias', sortOrder: 140 },
  // Serie blanca
  { practiceNbuCode: 'ACT-FROTIS-SP', unidadNombre: 'Neutrófilos', sortOrder: 200 },
  { practiceNbuCode: 'ACT-FROTIS-SP', unidadNombre: 'Linfocitos', sortOrder: 210 },
  { practiceNbuCode: 'ACT-FROTIS-SP', unidadNombre: 'Monocitos', sortOrder: 220 },
  { practiceNbuCode: 'ACT-FROTIS-SP', unidadNombre: 'Eosinófilos', sortOrder: 230 },
  { practiceNbuCode: 'ACT-FROTIS-SP', unidadNombre: 'Basófilos', sortOrder: 240 },
  { practiceNbuCode: 'ACT-FROTIS-SP', unidadNombre: 'Elementos inmaduros', sortOrder: 250 },
  // Serie plaquetaria
  { practiceNbuCode: 'ACT-FROTIS-SP', unidadNombre: 'Cantidad plaquetaria', sortOrder: 300 },
  { practiceNbuCode: 'ACT-FROTIS-SP', unidadNombre: 'Morfología plaquetaria', sortOrder: 310 },
  // Hemoparásitos
  { practiceNbuCode: 'ACT-FROTIS-SP', unidadNombre: 'Hemoparásitos', sortOrder: 400 },
  // Predefinidos
  { practiceNbuCode: 'ACT-FROTIS-SP', unidadNombre: 'Resultado predefinido (FSP)', sortOrder: 500 },

  // ══════════════════════════════════════════════════════════════════
  // EXUDADO VAGINAL / EVB (NBU: 669787)
  // ══════════════════════════════════════════════════════════════════
  { practiceNbuCode: '669787', unidadNombre: 'Cantidad (EVB)', sortOrder: 100 },
  { practiceNbuCode: '669787', unidadNombre: 'Color (EVB)', sortOrder: 110 },
  { practiceNbuCode: '669787', unidadNombre: 'Aspecto (EVB)', sortOrder: 120 },
  { practiceNbuCode: '669787', unidadNombre: 'pH (EVB)', sortOrder: 130 },
  { practiceNbuCode: '669787', unidadNombre: 'Test de aminas', sortOrder: 140 },
  { practiceNbuCode: '669787', unidadNombre: 'Trichomonas vaginalis', sortOrder: 200 },
  { practiceNbuCode: '669787', unidadNombre: 'Levaduras y/o pseudohifas', sortOrder: 210 },
  { practiceNbuCode: '669787', unidadNombre: 'Morfotipos bacterianos extraños', sortOrder: 220 },
  { practiceNbuCode: '669787', unidadNombre: 'RIV (Reacción inflamatoria vaginal)', sortOrder: 230 },
  { practiceNbuCode: '669787', unidadNombre: 'Células guía', sortOrder: 240 },
  { practiceNbuCode: '669787', unidadNombre: 'Valor numérico RIV', sortOrder: 250 },
  { practiceNbuCode: '669787', unidadNombre: 'EVB (diagnóstico)', sortOrder: 300 },
  { practiceNbuCode: '669787', unidadNombre: 'Observaciones EVB', sortOrder: 310 },
  { practiceNbuCode: '669787', unidadNombre: 'Cultivo (EVB)', sortOrder: 400 },
  { practiceNbuCode: '669787', unidadNombre: 'Conclusión (EVB)', sortOrder: 500 },

  // ══════════════════════════════════════════════════════════════════
  // ESPUTO / BACILOSCOPÍA (NBU: 660101)
  // ══════════════════════════════════════════════════════════════════
  { practiceNbuCode: '660101', unidadNombre: 'Células epiteliales (esputo)', sortOrder: 100 },
  { practiceNbuCode: '660101', unidadNombre: 'Leucocitos (esputo)', sortOrder: 110 },
  { practiceNbuCode: '660101', unidadNombre: 'Gram (esputo)', sortOrder: 200 },
  { practiceNbuCode: '660101', unidadNombre: 'BAAR (baciloscopía)', sortOrder: 300 },

  // ══════════════════════════════════════════════════════════════════
  // EXUDADO DE FAUCES (custom: ACT-EXUDADO-FAUCES)
  // ══════════════════════════════════════════════════════════════════
  { practiceNbuCode: 'ACT-EXUDADO-FAUCES', unidadNombre: 'Microscópico (fauces)', sortOrder: 100 },
  { practiceNbuCode: 'ACT-EXUDADO-FAUCES', unidadNombre: 'Cultivo (fauces)', sortOrder: 200 },
];

// ─── Script principal ─────────────────────────────────────────────────────────

async function run() {
  const db = getDb();

  // 1. Encontrar el laboratorio
  let lab: { id: number; slug: string } | undefined;
  if (LAB_SLUG) {
    const [found] = await db
      .select({ id: laboratorio.id, slug: laboratorio.slug })
      .from(laboratorio)
      .where(eq(laboratorio.slug, LAB_SLUG))
      .limit(1);
    if (!found) {
      console.error(`❌ No se encontró el laboratorio con slug "${LAB_SLUG}"`);
      process.exit(1);
    }
    lab = found;
  } else {
    const [found] = await db
      .select({ id: laboratorio.id, slug: laboratorio.slug })
      .from(laboratorio)
      .limit(1);
    if (!found) {
      console.error('❌ No hay laboratorios en la base de datos.');
      process.exit(1);
    }
    lab = found;
  }

  console.log(`✅ Laboratorio: "${lab.slug}" (id=${lab.id})`);
  const labId = lab.id;

  // 2. Crear prácticas custom si no existen
  console.log('\n📋 Verificando prácticas custom...');
  for (const p of CUSTOM_PRACTICES) {
    const [existing] = await db
      .select({ id: practice.id })
      .from(practice)
      .where(eq(practice.nbuCode, p.nbuCode))
      .limit(1);
    if (existing) {
      console.log(`  ⏭  ${p.name} (${p.nbuCode}) — ya existe`);
    } else {
      await db.insert(practice).values({
        nbuCode: p.nbuCode,
        name: p.name,
        shortName: p.shortName,
        category: p.category,
        section: p.section,
        units: p.units,
        isElaborated: p.isElaborated,
        isSpecialAct: p.isSpecialAct,
        active: p.active,
      });
      console.log(`  ✅ Creada práctica: ${p.name} (${p.nbuCode})`);
    }
  }

  // 3. Crear unidades de medida (idempotente via lower(nombre))
  console.log('\n🔬 Creando/verificando unidades de medida...');
  let createdUnidades = 0;
  let skippedUnidades = 0;

  for (const u of UNIDADES) {
    const [existing] = await db
      .select({ id: unidadMedida.id })
      .from(unidadMedida)
      .where(
        and(
          eq(unidadMedida.labId, labId),
          sql`lower(${unidadMedida.nombre}) = lower(${u.nombre})`,
        ),
      )
      .limit(1);

    if (existing) {
      // Actualizar opciones predeterminadas si las definimos
      if (u.opciones !== undefined) {
        await db
          .update(unidadMedida)
          .set({
            opcionesPredeterminadas: u.opciones,
            simbolo: u.simbolo ?? null,
            updatedAt: new Date(),
          })
          .where(eq(unidadMedida.id, existing.id));
      }
      skippedUnidades++;
    } else {
      await db.insert(unidadMedida).values({
        labId,
        nombre: u.nombre,
        simbolo: u.simbolo ?? null,
        opcionesPredeterminadas: u.opciones ?? null,
        active: true,
      });
      createdUnidades++;
    }
  }
  console.log(`  ✅ Creadas: ${createdUnidades} | Actualizadas: ${skippedUnidades}`);

  // 4. Construir mapa nombre → id de unidades
  const allUnidades = await db
    .select({ id: unidadMedida.id, nombre: unidadMedida.nombre })
    .from(unidadMedida)
    .where(eq(unidadMedida.labId, labId));
  const unidadByNombre = new Map(allUnidades.map((u) => [u.nombre.toLowerCase(), u.id]));

  // 5. Construir mapa nbuCode → id de prácticas
  const allPractices = await db
    .select({ id: practice.id, nbuCode: practice.nbuCode, name: practice.name })
    .from(practice);
  const practiceByNbu = new Map(allPractices.map((p) => [p.nbuCode, p]));

  // 6. Crear asociaciones práctica ↔ unidad
  console.log('\n🔗 Creando asociaciones práctica ↔ unidad...');
  let createdAssoc = 0;
  let skippedAssoc = 0;
  let errorAssoc = 0;

  for (const assoc of ASOCIACIONES) {
    const prac = practiceByNbu.get(assoc.practiceNbuCode);
    if (!prac) {
      console.warn(`  ⚠️  Práctica NBU "${assoc.practiceNbuCode}" no encontrada en DB — omitida`);
      errorAssoc++;
      continue;
    }

    const unidadId = unidadByNombre.get(assoc.unidadNombre.toLowerCase());
    if (!unidadId) {
      console.warn(`  ⚠️  Unidad "${assoc.unidadNombre}" no encontrada — omitida`);
      errorAssoc++;
      continue;
    }

    const [existing] = await db
      .select({ id: practiceUnidad.id })
      .from(practiceUnidad)
      .where(
        and(
          eq(practiceUnidad.labId, labId),
          eq(practiceUnidad.practiceId, prac.id),
          eq(practiceUnidad.unidadId, unidadId),
        ),
      )
      .limit(1);

    if (existing) {
      // Actualizar sort_order y referencias
      await db
        .update(practiceUnidad)
        .set({
          sortOrder: assoc.sortOrder,
          rangeLow: assoc.rangeLow ?? null,
          rangeHigh: assoc.rangeHigh ?? null,
          referenceText: assoc.referenceText ?? null,
        })
        .where(eq(practiceUnidad.id, existing.id));
      skippedAssoc++;
    } else {
      await db.insert(practiceUnidad).values({
        labId,
        practiceId: prac.id,
        unidadId,
        sortOrder: assoc.sortOrder,
        rangeLow: assoc.rangeLow ?? null,
        rangeHigh: assoc.rangeHigh ?? null,
        referenceText: assoc.referenceText ?? null,
      });
      createdAssoc++;
    }
  }
  console.log(`  ✅ Creadas: ${createdAssoc} | Actualizadas: ${skippedAssoc} | Errores: ${errorAssoc}`);

  // Resumen final
  console.log('\n📊 Resumen:');
  const counts = await db.execute(sql`
    SELECT
      (SELECT count(*) FROM unidad_medida WHERE lab_id = ${labId})            AS unidades,
      (SELECT count(*) FROM practice_unidad WHERE lab_id = ${labId})          AS asociaciones,
      (SELECT count(*) FROM practice WHERE nbu_code LIKE 'ACT-%')             AS practicas_custom
  `);
  console.log('  ', counts[0]);
}

run()
  .then(async () => {
    await closeDb();
    console.log('\n✅ Seed completado exitosamente.');
    process.exit(0);
  })
  .catch(async (err) => {
    console.error('\n❌ Error:', err);
    await closeDb();
    process.exit(1);
  });
