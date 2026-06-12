import {
  type RangeRule,
  type ReferenceValueTemplate,
  ageInYears,
  classifyResult,
  pickRangeRule,
} from './validation';

function date(yyyy: number, mm = 1, dd = 1): Date {
  return new Date(Date.UTC(yyyy, mm - 1, dd));
}

describe('ageInYears', () => {
  it('calcula edad floor', () => {
    expect(ageInYears(date(2000, 1, 1), date(2025, 1, 1))).toBe(25);
    expect(ageInYears(date(2000, 1, 1), date(2024, 12, 31))).toBe(24);
  });

  it('devuelve 0 si la fecha de nacimiento es futura', () => {
    expect(ageInYears(date(2050, 1, 1), date(2025, 1, 1))).toBe(0);
  });
});

describe('pickRangeRule', () => {
  const baseTemplate: ReferenceValueTemplate = {
    rules: [
      { band: { low: '10', high: '20' } }, // default
      { sex: 'F', band: { low: '12', high: '18' } },
      { sex: 'M', band: { low: '13', high: '22' } },
      {
        sex: 'F',
        ageFromYears: 0,
        ageToYears: 1,
        band: { low: '8', high: '12' },
      },
    ],
  };

  it('matchea sexo exacto sobre default', () => {
    const r = pickRangeRule(baseTemplate, { sex: 'F', birthDate: date(1990) }, date(2025));
    expect(r?.band.low).toBe('12'); // regla F adulto
  });

  it('matchea sexo + edad sobre solo sexo', () => {
    const r = pickRangeRule(baseTemplate, { sex: 'F', birthDate: date(2024, 6, 1) }, date(2025, 1, 1));
    expect(r?.band.low).toBe('8'); // regla F 0-1
  });

  it('cae al default cuando no hay regla por sexo', () => {
    const t: ReferenceValueTemplate = {
      rules: [
        { band: { low: '5', high: '10' } },
        { sex: 'F', band: { low: '1', high: '2' } },
      ],
    };
    const r = pickRangeRule(t, { sex: 'M', birthDate: date(1990) }, date(2025));
    expect(r?.band.low).toBe('5');
  });

  it('descarta reglas con sexo cuando patient.sex es null', () => {
    const t: ReferenceValueTemplate = {
      rules: [
        { sex: 'F', band: { low: '1', high: '2' } },
        { band: { low: '5', high: '10' } },
      ],
    };
    const r = pickRangeRule(t, { sex: null, birthDate: date(1990) }, date(2025));
    expect(r?.band.low).toBe('5'); // cae al default
  });

  it('devuelve null si ninguna regla matchea', () => {
    const t: ReferenceValueTemplate = {
      rules: [{ sex: 'F', band: { low: '1', high: '2' } }],
    };
    expect(pickRangeRule(t, { sex: 'M', birthDate: date(1990) }, date(2025))).toBeNull();
  });

  it('devuelve null para template vacio o nulo', () => {
    expect(pickRangeRule(null, { sex: 'F', birthDate: date(1990) })).toBeNull();
    expect(pickRangeRule({ rules: [] }, { sex: 'F', birthDate: date(1990) })).toBeNull();
  });

  it('ageToYears es exclusivo, ageFromYears es inclusivo', () => {
    const t: ReferenceValueTemplate = {
      rules: [
        { ageFromYears: 0, ageToYears: 1, band: { low: 'A', high: 'A' } },
        { ageFromYears: 1, ageToYears: 18, band: { low: 'B', high: 'B' } },
      ],
    };
    // edad exactamente 1 -> matchea regla B (no A)
    const r = pickRangeRule(t, { sex: null, birthDate: date(2024, 1, 1) }, date(2025, 1, 1));
    expect(r?.band.low).toBe('B');
  });
});

describe('classifyResult', () => {
  const rule: RangeRule = {
    band: { low: '10', high: '20', criticalLow: '5', criticalHigh: '25' },
  };

  it('clasifica normal dentro del rango', () => {
    expect(classifyResult('15', rule)).toBe('normal');
    expect(classifyResult('10', rule)).toBe('normal'); // borde inferior inclusivo
    expect(classifyResult('20', rule)).toBe('normal'); // borde superior inclusivo
  });

  it('clasifica low por debajo de low (no critico)', () => {
    expect(classifyResult('9.99', rule)).toBe('low');
    expect(classifyResult('6', rule)).toBe('low');
  });

  it('clasifica high por encima de high (no critico)', () => {
    expect(classifyResult('20.01', rule)).toBe('high');
    expect(classifyResult('24', rule)).toBe('high');
  });

  it('clasifica critical_low antes que low', () => {
    expect(classifyResult('4.99', rule)).toBe('critical_low');
    expect(classifyResult('0', rule)).toBe('critical_low');
  });

  it('clasifica critical_high antes que high', () => {
    expect(classifyResult('25.01', rule)).toBe('critical_high');
    expect(classifyResult('100', rule)).toBe('critical_high');
  });

  it('ignora bandas no definidas', () => {
    const onlyHigh: RangeRule = { band: { low: null, high: '50', criticalLow: null, criticalHigh: null } };
    expect(classifyResult('0', onlyHigh)).toBe('normal');
    expect(classifyResult('51', onlyHigh)).toBe('high');
  });

  it('borde inclusivo en criticalLow (igual a criticalLow no es critico)', () => {
    expect(classifyResult('5', rule)).toBe('low'); // 5 == criticalLow → no es lt critical, pero es lt low
  });

  it('decimal precision exacta', () => {
    const r: RangeRule = { band: { low: '0.500', high: '0.700' } };
    expect(classifyResult('0.4999', r)).toBe('low');
    expect(classifyResult('0.500', r)).toBe('normal');
    expect(classifyResult('0.7001', r)).toBe('high');
  });
});
