import Decimal from 'decimal.js';
import {
  ZERO,
  addMoney,
  eqMoney,
  gtMoney,
  ltMoney,
  multiplyMoney,
  subMoney,
  sumMoney,
  toDecimal,
  toMoneyString,
} from './money';

describe('toDecimal', () => {
  it('rechaza JS number con TypeError explicito', () => {
    expect(() => toDecimal(1650.1 as unknown as string)).toThrow(TypeError);
    expect(() => toDecimal(0 as unknown as string)).toThrow(/JS number/);
  });

  it('acepta strings y Decimal', () => {
    expect(toDecimal('123.45')).toBeInstanceOf(Decimal);
    const d = new Decimal('99.99');
    expect(toDecimal(d)).toBe(d);
  });
});

describe('toMoneyString', () => {
  it('formatea a 2 decimales fijos', () => {
    expect(toMoneyString(new Decimal('1'))).toBe('1.00');
    expect(toMoneyString(new Decimal('1.2'))).toBe('1.20');
    expect(toMoneyString(new Decimal('1.235'))).toBe('1.24'); // HALF_UP
  });
});

describe('addMoney', () => {
  it('suma sin perder precision', () => {
    expect(addMoney('1650.10', '0.20')).toBe('1650.30');
    expect(addMoney('0.10', '0.20')).toBe('0.30'); // donde JS number falla
  });

  it('redondea con HALF_UP', () => {
    expect(addMoney('0.005', '0.005')).toBe('0.01');
    expect(addMoney('0.001', '0.001')).toBe('0.00');
  });
});

describe('subMoney', () => {
  it('resta correctamente', () => {
    expect(subMoney('100.00', '0.10')).toBe('99.90');
    expect(subMoney('1.00', '1.00')).toBe('0.00');
  });
});

describe('multiplyMoney', () => {
  it('multiplica con HALF_UP a 2 decimales', () => {
    expect(multiplyMoney('100.00', '1.255')).toBe('125.50');
    expect(multiplyMoney('1650.00', '2.5')).toBe('4125.00');
  });

  it('respeta factor 0', () => {
    expect(multiplyMoney('999.99', '0')).toBe('0.00');
  });

  it('manejo correcto de UB units fraccionarios', () => {
    // 0.50 UB * 1650.00 = 825.00 (Urgencia)
    expect(multiplyMoney('0.50', '1650.00')).toBe('825.00');
  });
});

describe('sumMoney', () => {
  it('devuelve 0.00 para array vacio', () => {
    expect(sumMoney([])).toBe('0.00');
  });

  it('suma N valores con HALF_UP', () => {
    expect(sumMoney(['10.00', '20.55', '0.45'])).toBe('31.00');
    expect(sumMoney(['1.005', '1.005', '1.005'])).toBe('3.02'); // 3.015 HALF_UP → 3.02
  });
});

describe('comparaciones', () => {
  it('eqMoney compara semanticamente, no por string', () => {
    expect(eqMoney('1.00', '1.0')).toBe(true);
    expect(eqMoney('1.00', '1.000')).toBe(true);
    expect(eqMoney('1.00', '1.01')).toBe(false);
  });

  it('gtMoney y ltMoney funcionan correctamente', () => {
    expect(gtMoney('2.00', '1.99')).toBe(true);
    expect(gtMoney('1.99', '2.00')).toBe(false);
    expect(ltMoney('1.99', '2.00')).toBe(true);
    expect(ltMoney('2.00', '2.00')).toBe(false);
  });
});

describe('ZERO', () => {
  it('es "0.00" branded', () => {
    expect(ZERO).toBe('0.00');
  });
});
