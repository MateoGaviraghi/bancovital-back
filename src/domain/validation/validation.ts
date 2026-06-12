import Decimal from 'decimal.js';

export type ResultFlag = 'normal' | 'low' | 'high' | 'critical_low' | 'critical_high';

export type PatientSex = 'F' | 'M' | 'X';

export interface RangeBand {
  low?: string | null;
  high?: string | null;
  criticalLow?: string | null;
  criticalHigh?: string | null;
}

export interface RangeRule {
  /** null/undefined = aplica a cualquier sexo. */
  sex?: PatientSex | null;
  /** null/undefined = sin floor de edad. Inclusivo (`age >= ageFromYears`). */
  ageFromYears?: number | null;
  /** null/undefined = sin techo de edad. Exclusivo (`age < ageToYears`). */
  ageToYears?: number | null;
  band: RangeBand;
  unit?: string;
}

/**
 * Estructura del `practice.reference_value_template` (jsonb).
 */
export interface ReferenceValueTemplate {
  rules: RangeRule[];
  defaultUnit?: string;
  methodology?: string;
}

export interface PatientForRange {
  sex: PatientSex | null;
  /** null = paciente sin fecha de nacimiento: se omiten las reglas con restriccion de edad. */
  birthDate: Date | null;
}

export function ageInYears(birthDate: Date, at: Date = new Date()): number {
  const diffMs = at.getTime() - birthDate.getTime();
  if (diffMs < 0) return 0;
  const yearMs = 365.2425 * 24 * 60 * 60 * 1000;
  return Math.floor(diffMs / yearMs);
}

/**
 * Devuelve la regla mas especifica que matchea al paciente.
 *
 * Score: sexo exacto (+2) + ventana de edad (+1). Mayor gana. La regla "default"
 * (sin restricciones de sexo ni edad) tiene score 0 y se elige solo si no hay
 * otra. Si ninguna matchea devuelve null.
 *
 * Reglas:
 * - sex en la regla = null -> matchea cualquier sexo del paciente
 * - sex en la regla != null + sex paciente null -> NO matchea (regla es estricta)
 * - ageFromYears inclusivo, ageToYears exclusivo
 */
export function pickRangeRule(
  template: ReferenceValueTemplate | null | undefined,
  patient: PatientForRange,
  at: Date = new Date(),
): RangeRule | null {
  if (!template || template.rules.length === 0) return null;
  const age = patient.birthDate ? ageInYears(patient.birthDate, at) : null;

  const matches = template.rules
    .map((r) => {
      const ruleSex = r.sex ?? null;
      const sexMatch = ruleSex === null ? true : patient.sex !== null && patient.sex === ruleSex;
      const hasAgeConstraint = r.ageFromYears != null || r.ageToYears != null;
      // Sin fecha de nacimiento no se puede evaluar la edad: solo aplican
      // reglas sin restriccion etaria (se omite el rango por edad).
      const ageOk =
        age === null
          ? !hasAgeConstraint
          : (r.ageFromYears == null || age >= r.ageFromYears) &&
            (r.ageToYears == null || age < r.ageToYears);
      if (!sexMatch || !ageOk) return null;
      const score = (ruleSex !== null ? 2 : 0) + (r.ageFromYears != null || r.ageToYears != null ? 1 : 0);
      return { rule: r, score };
    })
    .filter((x): x is { rule: RangeRule; score: number } => x !== null);

  if (matches.length === 0) return null;
  matches.sort((a, b) => b.score - a.score);
  return matches[0].rule;
}

/**
 * Clasifica un resultado numerico contra el band de la regla.
 *
 * Orden de evaluacion: criticalLow -> criticalHigh -> low -> high -> normal.
 * Bandas no definidas se ignoran.
 */
export function classifyResult(value: string, rule: RangeRule): ResultFlag {
  const v = new Decimal(value);
  const { low, high, criticalLow, criticalHigh } = rule.band;

  if (criticalLow != null && v.lt(new Decimal(criticalLow))) return 'critical_low';
  if (criticalHigh != null && v.gt(new Decimal(criticalHigh))) return 'critical_high';
  if (low != null && v.lt(new Decimal(low))) return 'low';
  if (high != null && v.gt(new Decimal(high))) return 'high';
  return 'normal';
}
