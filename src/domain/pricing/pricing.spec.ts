import {
  type PriceablePractice,
  type PricingInput,
  SPECIAL_ACT_CODES,
  calculateOrderPricing,
} from './pricing';

function baseInput(overrides: Partial<PricingInput> = {}): PricingInput {
  return {
    insurerCode: 'PARTICULAR',
    ubInsurer: '1650.00',
    ubParticular: '1650.00',
    isUrgent: false,
    practices: [],
    ...overrides,
  };
}

const PRACTICE_X = (): PriceablePractice => ({
  practiceId: 1,
  nbuCode: '500001',
  name: 'Hemograma',
  units: '2.00',
  isSpecialAct: false,
});

const PRACTICE_SPECIAL = (): PriceablePractice => ({
  practiceId: 2,
  nbuCode: '880001',
  name: 'Sobrecarga de glucosa',
  units: '3.00',
  isSpecialAct: true,
});

describe('Special acts (660001 / 661200 / 662001)', () => {
  it('SIEMPRE inyecta 660001 Acto Bioquimico aunque no haya practicas', () => {
    const r = calculateOrderPricing(baseInput());
    const codes = r.lines.map((l) => l.nbuCode);
    expect(codes).toEqual([SPECIAL_ACT_CODES.ACTO_BIOQUIMICO]);
    expect(r.lines[0].synthetic).toBe(true);
  });

  it('NO inyecta 661200 si isUrgent=false', () => {
    const r = calculateOrderPricing(baseInput({ practices: [PRACTICE_X()] }));
    expect(r.lines.find((l) => l.nbuCode === SPECIAL_ACT_CODES.URGENCIA)).toBeUndefined();
  });

  it('inyecta 661200 Urgencia con 0.50 UB cuando isUrgent=true', () => {
    const r = calculateOrderPricing(baseInput({ isUrgent: true, practices: [PRACTICE_X()] }));
    const urg = r.lines.find((l) => l.nbuCode === SPECIAL_ACT_CODES.URGENCIA);
    expect(urg).toBeDefined();
    expect(urg!.units).toBe('0.50');
    expect(urg!.synthetic).toBe(true);
    expect(urg!.practiceId).toBeNull();
  });

  it('NO inyecta 662001 ABC si ninguna practica es special act', () => {
    const r = calculateOrderPricing(baseInput({ practices: [PRACTICE_X()] }));
    expect(r.lines.find((l) => l.nbuCode === SPECIAL_ACT_CODES.ABC)).toBeUndefined();
  });

  it('inyecta 662001 ABC con 1.00 UB cuando alguna practica es special act', () => {
    const r = calculateOrderPricing(baseInput({ practices: [PRACTICE_X(), PRACTICE_SPECIAL()] }));
    const abc = r.lines.find((l) => l.nbuCode === SPECIAL_ACT_CODES.ABC);
    expect(abc).toBeDefined();
    expect(abc!.units).toBe('1.00');
  });

  it('inyecta los 3 special acts cuando isUrgent + isSpecialAct', () => {
    const r = calculateOrderPricing(baseInput({ isUrgent: true, practices: [PRACTICE_SPECIAL()] }));
    const codes = r.lines
      .filter((l) => l.synthetic)
      .map((l) => l.nbuCode)
      .sort();
    expect(codes).toEqual(
      [SPECIAL_ACT_CODES.ACTO_BIOQUIMICO, SPECIAL_ACT_CODES.URGENCIA, SPECIAL_ACT_CODES.ABC].sort(),
    );
  });

  it('special acts tienen practiceId=null y synthetic=true', () => {
    const r = calculateOrderPricing(baseInput({ isUrgent: true, practices: [PRACTICE_SPECIAL()] }));
    const synths = r.lines.filter((l) => l.synthetic);
    expect(synths.every((l) => l.practiceId === null && l.synthetic === true)).toBe(true);
  });
});

describe('Pricing PARTICULAR sin copay', () => {
  it('priceParticular = priceInsurer cuando ubParticular = ubInsurer', () => {
    const r = calculateOrderPricing(baseInput({ practices: [PRACTICE_X()] }));
    const user = r.lines.find((l) => l.practiceId === 1)!;
    expect(user.priceInsurer).toBe('3300.00'); // 2 * 1650
    expect(user.priceParticular).toBe('3300.00');
    expect(user.patientCopay).toBe('0.00');
    expect(r.totals.patientCopay).toBe('0.00');
  });

  it('Particular puede tener UB distinto al de la "obra" (caso degenerado)', () => {
    const r = calculateOrderPricing(
      baseInput({ ubInsurer: '1500.00', ubParticular: '2000.00', practices: [PRACTICE_X()] }),
    );
    const user = r.lines.find((l) => l.practiceId === 1)!;
    expect(user.priceInsurer).toBe('3000.00');
    expect(user.priceParticular).toBe('4000.00');
  });
});

describe('Pricing IAPOS con copay', () => {
  it('aplica copayRate sobre priceInsurer en todas las lineas (incluido special acts)', () => {
    const r = calculateOrderPricing(
      baseInput({
        insurerCode: 'IAPOS',
        ubInsurer: '1000.00',
        ubParticular: '1500.00',
        copayRate: '0.20',
        practices: [PRACTICE_X()],
      }),
    );
    // user: 2 * 1000 = 2000, copay 20% = 400
    // acto: 1 * 1000 = 1000, copay 20% = 200
    // total copay = 600
    const user = r.lines.find((l) => l.practiceId === 1)!;
    expect(user.priceInsurer).toBe('2000.00');
    expect(user.patientCopay).toBe('400.00');

    const acto = r.lines.find((l) => l.nbuCode === SPECIAL_ACT_CODES.ACTO_BIOQUIMICO)!;
    expect(acto.priceInsurer).toBe('1000.00');
    expect(acto.patientCopay).toBe('200.00');

    expect(r.totals.patientCopay).toBe('600.00');
  });

  it('copayRate=0 equivale a no aplicar copay', () => {
    const r = calculateOrderPricing(baseInput({ copayRate: '0', practices: [PRACTICE_X()] }));
    expect(r.totals.patientCopay).toBe('0.00');
  });
});

describe('Totales y snapshots', () => {
  it('totals.insurer suma todas las lineas (user + special)', () => {
    const r = calculateOrderPricing(
      baseInput({ ubInsurer: '100.10', ubParticular: '120.00', practices: [PRACTICE_X()] }),
    );
    // user: 2 * 100.10 = 200.20
    // acto: 1 * 100.10 = 100.10
    expect(r.totals.insurer).toBe('300.30');
  });

  it('totals.particular suma todas las lineas con ubParticular', () => {
    const r = calculateOrderPricing(
      baseInput({ ubInsurer: '100.10', ubParticular: '120.00', practices: [PRACTICE_X()] }),
    );
    // user: 2 * 120 = 240.00
    // acto: 1 * 120 = 120.00
    expect(r.totals.particular).toBe('360.00');
  });

  it('ubValueUsed es snapshot del ubInsurer formateado 2 decimales', () => {
    const r = calculateOrderPricing(baseInput({ ubInsurer: '1742.5' }));
    expect(r.ubValueUsed).toBe('1742.50');
  });

  it('cada PricedLine guarda su ubValue snapshot', () => {
    const r = calculateOrderPricing(baseInput({ ubInsurer: '1234.56', practices: [PRACTICE_X()] }));
    for (const l of r.lines) {
      expect(l.ubValue).toBe('1234.56');
    }
  });

  it('precision HALF_UP en redondeos', () => {
    // 1.255 * 100 = 125.50 (HALF_UP)
    const r = calculateOrderPricing(
      baseInput({
        ubInsurer: '1.255',
        ubParticular: '1.255',
        practices: [
          { practiceId: 1, nbuCode: 'X', name: 'X', units: '100.00', isSpecialAct: false },
        ],
      }),
    );
    expect(r.lines[0].priceInsurer).toBe('125.50');
  });
});

describe('Casos combinados', () => {
  it('Urgencia + ABC + multiples practicas + copay', () => {
    const r = calculateOrderPricing(
      baseInput({
        insurerCode: 'IAPOS',
        ubInsurer: '1000.00',
        ubParticular: '1200.00',
        copayRate: '0.10',
        isUrgent: true,
        practices: [PRACTICE_X(), PRACTICE_SPECIAL()],
      }),
    );
    // user1 hemograma: 2 * 1000 = 2000 insurer, copay 200
    // user2 sobrecarga: 3 * 1000 = 3000 insurer, copay 300
    // acto: 1000, copay 100
    // urgencia: 0.50 * 1000 = 500, copay 50
    // abc: 1 * 1000 = 1000, copay 100
    // total insurer = 7500, copay total = 750
    expect(r.totals.insurer).toBe('7500.00');
    expect(r.totals.patientCopay).toBe('750.00');
    expect(r.lines).toHaveLength(5); // 2 user + 3 special
  });
});
