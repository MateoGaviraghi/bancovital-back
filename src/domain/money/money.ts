import Decimal from 'decimal.js';

Decimal.set({ precision: 30, rounding: Decimal.ROUND_HALF_UP });

export type MoneyString = string & { readonly __brand: 'MoneyString' };

export const ZERO = '0.00' as MoneyString;

export function toDecimal(value: string | Decimal): Decimal {
  if (typeof value === 'number') {
    throw new TypeError(
      'Money values must never originate from a JS number. Pass a string or a Decimal.',
    );
  }
  if (value instanceof Decimal) return value;
  return new Decimal(value);
}

export function toMoneyString(value: Decimal): MoneyString {
  return value.toFixed(2) as MoneyString;
}

export function addMoney(a: string, b: string): MoneyString {
  return toMoneyString(toDecimal(a).plus(toDecimal(b)));
}

export function subMoney(a: string, b: string): MoneyString {
  return toMoneyString(toDecimal(a).minus(toDecimal(b)));
}

export function multiplyMoney(amount: string, factor: string): MoneyString {
  return toMoneyString(toDecimal(amount).times(toDecimal(factor)));
}

export function sumMoney(values: readonly string[]): MoneyString {
  return toMoneyString(values.reduce((acc, v) => acc.plus(toDecimal(v)), new Decimal(0)));
}

export function eqMoney(a: string, b: string): boolean {
  return toDecimal(a).eq(toDecimal(b));
}

export function gtMoney(a: string, b: string): boolean {
  return toDecimal(a).gt(toDecimal(b));
}

export function ltMoney(a: string, b: string): boolean {
  return toDecimal(a).lt(toDecimal(b));
}
