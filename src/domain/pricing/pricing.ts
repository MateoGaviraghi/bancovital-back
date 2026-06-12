import Decimal from 'decimal.js';
import {
  type MoneyString,
  ZERO,
  addMoney,
  multiplyMoney,
  sumMoney,
  toDecimal,
  toMoneyString,
} from '../money/money';

export const SPECIAL_ACT_CODES = {
  ACTO_BIOQUIMICO: '660001',
  URGENCIA: '661200',
  ABC: '662001',
} as const;

export type SpecialActCode = (typeof SPECIAL_ACT_CODES)[keyof typeof SPECIAL_ACT_CODES];

export interface PriceablePractice {
  /** Catalog id; null para special acts sinteticos. */
  practiceId: number | null;
  nbuCode: string;
  name: string;
  /** UB units como decimal string ("2.00"). */
  units: string;
  /** TRUE para sobrecarga/inhibicion/estimulo. Dispara inyeccion de 662001. */
  isSpecialAct: boolean;
}

export interface PricingInput {
  insurerCode: string;
  /** UB resuelta para la obra al order_date (decimal string). */
  ubInsurer: string;
  /** UB resuelta para Particular al order_date (decimal string). */
  ubParticular: string;
  /** Tasa de copago 0..1 (decimal string). Si esta ausente, copay = 0. */
  copayRate?: string;
  isUrgent: boolean;
  practices: PriceablePractice[];
}

export interface PricedLine {
  practiceId: number | null;
  nbuCode: string;
  name: string;
  units: string;
  /** UB de la obra al order_date (snapshot por linea). */
  ubValue: MoneyString;
  priceParticular: MoneyString;
  priceInsurer: MoneyString;
  patientCopay: MoneyString;
  /** TRUE para lineas inyectadas por el engine (660001/661200/662001). */
  synthetic: boolean;
}

export interface PricingOutput {
  lines: PricedLine[];
  totals: {
    particular: MoneyString;
    insurer: MoneyString;
    patientCopay: MoneyString;
  };
  /** UB usada (insurer). Se snapshotea en order.ub_value_used. */
  ubValueUsed: MoneyString;
}

function buildSpecialActLines(args: {
  isUrgent: boolean;
  practices: PriceablePractice[];
}): PriceablePractice[] {
  const out: PriceablePractice[] = [];

  out.push({
    practiceId: null,
    nbuCode: SPECIAL_ACT_CODES.ACTO_BIOQUIMICO,
    name: 'Acto bioquimico',
    units: '1.00',
    isSpecialAct: false,
  });

  if (args.isUrgent) {
    out.push({
      practiceId: null,
      nbuCode: SPECIAL_ACT_CODES.URGENCIA,
      name: 'Urgencia',
      units: '0.50',
      isSpecialAct: false,
    });
  }

  if (args.practices.some((p) => p.isSpecialAct)) {
    out.push({
      practiceId: null,
      nbuCode: SPECIAL_ACT_CODES.ABC,
      name: 'Acto bioquimico complementario (ABC)',
      units: '1.00',
      isSpecialAct: false,
    });
  }

  return out;
}

function computeCopay(priceInsurer: string, copayRate?: string): MoneyString {
  if (!copayRate) return ZERO;
  const rate = toDecimal(copayRate);
  if (rate.lte(0)) return ZERO;
  return multiplyMoney(priceInsurer, copayRate);
}

/**
 * Motor de calculo de precios NBU.
 *
 * Algoritmo:
 *   1. Por cada practica del input:
 *        priceParticular = units * ubParticular
 *        priceInsurer    = units * ubInsurer
 *        patientCopay    = priceInsurer * copayRate (si > 0)
 *   2. Inyecta special acts sinteticos al final:
 *        660001 Acto Bioquimico   siempre, 1.00 UB
 *        661200 Urgencia          si isUrgent, 0.50 UB
 *        662001 ABC               si alguna practica.isSpecialAct, 1.00 UB
 *   3. Suma totales con Money. Aritmetica via decimal.js ROUND_HALF_UP @ 2 dec.
 *
 * Sin IO. Sin DB. Los snapshots (nbu_code, name, units, ubValue, precios) se
 * persisten en order_practice por el OrdersService.
 */
export function calculateOrderPricing(input: PricingInput): PricingOutput {
  const { ubInsurer, ubParticular, copayRate, isUrgent, practices } = input;

  const ubInsurerSnapshot = toMoneyString(new Decimal(ubInsurer));

  const userLines: PricedLine[] = practices.map((p) => priceLine(p, ubInsurer, ubInsurerSnapshot, ubParticular, copayRate, false));

  const specialInputs = buildSpecialActLines({ isUrgent, practices });
  const specialLines: PricedLine[] = specialInputs.map((p) =>
    priceLine(p, ubInsurer, ubInsurerSnapshot, ubParticular, copayRate, true),
  );

  const lines = [...userLines, ...specialLines];

  return {
    lines,
    totals: {
      particular: sumMoney(lines.map((l) => l.priceParticular)),
      insurer: sumMoney(lines.map((l) => l.priceInsurer)),
      patientCopay: lines.reduce<MoneyString>(
        (acc, l) => addMoney(acc, l.patientCopay),
        ZERO,
      ),
    },
    ubValueUsed: ubInsurerSnapshot,
  };
}

function priceLine(
  p: PriceablePractice,
  ubInsurer: string,
  ubInsurerSnapshot: MoneyString,
  ubParticular: string,
  copayRate: string | undefined,
  synthetic: boolean,
): PricedLine {
  const priceParticular = multiplyMoney(p.units, ubParticular);
  const priceInsurer = multiplyMoney(p.units, ubInsurer);
  const patientCopay = computeCopay(priceInsurer, copayRate);

  return {
    practiceId: p.practiceId,
    nbuCode: p.nbuCode,
    name: p.name,
    units: p.units,
    ubValue: ubInsurerSnapshot,
    priceParticular,
    priceInsurer,
    patientCopay,
    synthetic,
  };
}
