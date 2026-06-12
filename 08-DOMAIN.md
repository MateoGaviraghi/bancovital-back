# 08 — Lógica de negocio (domain)

Estas carpetas son **puras**: sin IO, sin DB, sin HTTP. Funciones que reciben input y devuelven output. Fáciles de testear con Jest.

```
src/domain/
├── money/
├── pricing/
├── status/
└── validation/
```

## money/

Manejo de plata con `decimal.js`. **JS `number` está PROHIBIDO** para plata.

### Reglas

- Toda plata en wire: string con 2 decimales (`"12450.00"`).
- Internamente: `Decimal` (precisión 30).
- Redondeo: `Decimal.ROUND_HALF_UP` siempre.
- Comparaciones via `.eq()`, `.gt()`, `.lt()` — nunca `==` o `>`.

### API

`src/domain/money/money.ts`:

```typescript
import Decimal from 'decimal.js';

Decimal.set({ precision: 30, rounding: Decimal.ROUND_HALF_UP });

export type MoneyString = string;  // brand opaco, formato "X.XX"

export const Money = {
  zero: '0.00' as MoneyString,

  of(value: string | number | Decimal): Decimal {
    if (typeof value === 'number') {
      throw new TypeError('No JS number for money. Use string or Decimal.');
    }
    return new Decimal(value);
  },

  toWire(d: Decimal): MoneyString {
    return d.toFixed(2);
  },

  add(...values: (string | Decimal)[]): MoneyString {
    return values.reduce((acc, v) => acc.add(Money.of(v as any)), new Decimal(0)).toFixed(2);
  },

  mul(value: string | Decimal, factor: string | Decimal): MoneyString {
    return Money.of(value as any).mul(Money.of(factor as any)).toFixed(2);
  },
};
```

## pricing/

Motor de cálculo de precios de la orden. **Crítico para el negocio.**

### Inputs

```typescript
type PriceablePractice = {
  practiceId: number;
  nbuCode: string;
  name: string;
  units: string;        // UB units
  isSpecialAct: boolean;
};

type PricingInput = {
  insurerCode: string;        // 'IAPOS', 'PARTICULAR', etc.
  ubInsurer: string;          // valor UB para esa obra
  ubParticular: string;       // valor UB particular
  isUrgent: boolean;
  practices: PriceablePractice[];
};
```

### Output

```typescript
type PricingOutput = {
  ubValueUsed: string;  // ubInsurer (snapshot)
  lines: Array<{
    practiceId: number | null;  // null para special acts sintéticos
    nbuCode: string;
    name: string;
    units: string;
    ubValue: string;
    priceParticular: string;
    priceInsurer: string;
    patientCopay: string;
  }>;
  totals: {
    particular: string;
    insurer: string;
    patientCopay: string;
  };
};
```

### Reglas

1. Para cada práctica del cliente:
   - `priceParticular = units × ubParticular`
   - `priceInsurer = units × ubInsurer`
   - `patientCopay = priceInsurer × copayRate` (si la obra tiene)

2. **Special acts sintéticos** se inyectan al final:
   - `660001` "Acto Bioquímico" → SIEMPRE
   - `661200` "Urgencia" → si `isUrgent`
   - `662001` "ABC" → si alguna práctica tiene `isSpecialAct === true`

3. Los special acts tienen `units = 1`, `practiceId = null`, mismas reglas de precio.

4. Totales: suma de líneas con `Money.add(...)`.

### Snapshot

Cada línea se guarda en `order_practice` con:
- `nbu_code_snapshot`
- `name_snapshot`
- `units_snapshot`
- `ub_value_snapshot`
- `price_particular`, `price_insurer`, `patient_copay`

Esto garantiza que la orden conserve su pricing aunque cambie el catálogo después.

### Función pública

```typescript
export function calculateOrderPricing(input: PricingInput): PricingOutput {
  // 1) Para cada practice del input, calcular line.
  // 2) Inyectar special acts según reglas.
  // 3) Sumar totals.
  // 4) Return.
}
```

## status/

Máquina de estados de la orden.

### Estados

```
borrador → confirmada → en_proceso → resultados_cargados → emitida → entregada
   ↓           ↓              ↓                  ↓               ↓         ↓
anulada    anulada       anulada            anulada         anulada   anulada
```

### Reglas (matriz de transiciones)

```typescript
type OrderStatus =
  | 'borrador' | 'confirmada' | 'en_proceso' | 'resultados_cargados'
  | 'emitida' | 'entregada' | 'anulada';

const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  borrador: ['confirmada', 'anulada'],
  confirmada: ['en_proceso', 'anulada'],
  en_proceso: ['resultados_cargados', 'anulada'],
  resultados_cargados: ['emitida', 'anulada'],
  emitida: ['entregada', 'anulada'],
  entregada: [],
  anulada: [],
};

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export function nextStatuses(from: OrderStatus): OrderStatus[] {
  return TRANSITIONS[from] ?? [];
}
```

### Uso

```typescript
if (!canTransition(order.status, 'confirmada')) {
  throw new ConflictException(`No se puede pasar de ${order.status} a confirmada`);
}
```

## validation/

Clasificación de resultados contra rangos de referencia.

### Tipos

```typescript
export type ReferenceValueTemplate = {
  rules: RangeRule[];
};

export type RangeRule = {
  sex: 'F' | 'M' | 'X' | null;  // null = aplica a cualquier sexo
  ageFromYears: number | null;   // null = sin floor
  ageToYears: number | null;     // null = sin techo
  band: {
    low: string | null;
    high: string | null;
    criticalLow: string | null;
    criticalHigh: string | null;
  };
};

export type ResultFlag = 'normal' | 'low' | 'high' | 'critical_low' | 'critical_high';
```

### pickRangeRule

Selecciona la regla más específica para un paciente:

```typescript
export function pickRangeRule(
  template: ReferenceValueTemplate,
  patient: { sex: 'F' | 'M' | 'X' | null; birthDate: Date | string },
  at: Date = new Date(),
): RangeRule | null {
  const age = computeAgeYears(patient.birthDate, at);
  const candidates = template.rules.filter((r) => {
    const sexMatches = !r.sex || r.sex === patient.sex;
    const ageMatches =
      (r.ageFromYears == null || age >= r.ageFromYears) &&
      (r.ageToYears == null || age < r.ageToYears);
    return sexMatches && ageMatches;
  });

  if (candidates.length === 0) return null;

  // Score: sex match worth +2, age window worth +1
  const scored = candidates.map((r) => ({
    rule: r,
    score: (r.sex ? 2 : 0) + ((r.ageFromYears != null || r.ageToYears != null) ? 1 : 0),
  }));
  scored.sort((a, b) => b.score - a.score);
  return scored[0]!.rule;
}

function computeAgeYears(birth: Date | string, at: Date): number {
  const b = typeof birth === 'string' ? new Date(birth) : birth;
  const diffMs = at.getTime() - b.getTime();
  return Math.floor(diffMs / (365.2425 * 24 * 60 * 60 * 1000));
}
```

### classifyResult

```typescript
import Decimal from 'decimal.js';

export function classifyResult(valueStr: string, rule: RangeRule): ResultFlag {
  const v = new Decimal(valueStr);
  const { low, high, criticalLow, criticalHigh } = rule.band;

  if (criticalLow && v.lt(criticalLow)) return 'critical_low';
  if (criticalHigh && v.gt(criticalHigh)) return 'critical_high';
  if (low && v.lt(low)) return 'low';
  if (high && v.gt(high)) return 'high';
  return 'normal';
}
```

## Tests

Cada función pura tiene su test Jest:

```
src/domain/
├── money/
│   ├── money.ts
│   └── money.spec.ts
├── pricing/
│   ├── pricing.ts
│   └── pricing.spec.ts
├── status/
│   ├── status.ts
│   └── status.spec.ts
└── validation/
    ├── validation.ts
    └── validation.spec.ts
```

Ejemplo `money.spec.ts`:

```typescript
import { Money } from './money';

describe('Money', () => {
  it('rejects JS numbers', () => {
    expect(() => Money.of(123 as any)).toThrow(TypeError);
  });

  it('adds with HALF_UP rounding', () => {
    expect(Money.add('1.005', '1.005')).toBe('2.01');
  });

  it('mul preserves 2 decimals', () => {
    expect(Money.mul('100.00', '0.21')).toBe('21.00');
  });
});
```

**Los tests de pricing son no-negociables.** Cubrir:
- IAPOS con copay
- PARTICULAR sin copay
- Urgencia (especial 661200)
- Práctica especial (ABC 662001)
- Todas las combinaciones
