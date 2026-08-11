# Relevamiento: Prácticas Compuestas — Actitud+ Lab

> **Fecha:** 2026-08-10  
> **Propósito:** Base de conocimiento para diseñar la funcionalidad de "prácticas compuestas" (prácticas que contienen sub-prácticas o sub-componentes, ej. Hemograma, Hepatograma, Orina Completa).

---

## 1. Estructura de Base de Datos

### 1.1 `practice` — catálogo de prácticas

```sql
CREATE TABLE practice (
  id                       bigint PRIMARY KEY,
  nbu_code                 text NOT NULL UNIQUE,          -- código nomenclador
  name                     text NOT NULL,
  short_name               text,
  category                 text,
  section                  text,
  units                    numeric,                       -- UBs del nomenclador
  requires_authorization   boolean NOT NULL DEFAULT false,
  is_special_act           boolean NOT NULL DEFAULT false,
  active                   boolean NOT NULL DEFAULT true,
  parent_id                bigint REFERENCES practice(id),-- FK self-ref (hijo → padre)
  precio_particular        numeric,                       -- precio fijo; NULL = calcular por UB
  reference_value          text,                          -- valor de ref. global (pre-lab_practice_config)
  reference_value_template jsonb,                         -- template (no usado actualmente)
  methodology              text,
  default_unit             text,
  is_elaborated            boolean NOT NULL DEFAULT false,
  condicion_visibilidad    jsonb,
  notes                    text,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now()
);
```

**Regla clave:** `parent_id IS NULL` → práctica raíz (aparece en el buscador de órdenes).  
`parent_id IS NOT NULL` → subpráctica (se incluye automáticamente al agregar el padre).

---

### 1.2 `unidad_medida` — catálogo de sub-componentes reutilizables

```sql
CREATE TABLE unidad_medida (
  id                      bigint PRIMARY KEY,
  lab_id                  bigint,                         -- NULL = global/compartido
  nombre                  text NOT NULL,                  -- ej. "Leucocitos", "Hemoglobina"
  simbolo                 text,                           -- ej. "mg/dL", "g/dL"
  opciones_predeterminadas jsonb,                         -- string[] de opciones preset
  metodologia             text,
  active                  boolean NOT NULL DEFAULT true,
  created_by              uuid,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);
```

> Es un catálogo de magnitudes/parámetros independientes. Una unidad_medida como "Hemoglobina" puede pertenecer a múltiples prácticas (Hemograma, Frotis, etc.).

---

### 1.3 `practice_unidad` — pivot M:N práctica × unidad_medida

```sql
CREATE TABLE practice_unidad (
  id             bigint PRIMARY KEY,
  practice_id    bigint NOT NULL REFERENCES practice(id),
  unidad_id      bigint NOT NULL REFERENCES unidad_medida(id),
  lab_id         bigint,                    -- NULL = configuración global
  sort_order     integer NOT NULL DEFAULT 0,
  range_low      numeric,                   -- límite inferior del rango normal
  range_high     numeric,                   -- límite superior del rango normal
  reference_text text,                      -- texto libre alternativo al rango numérico
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);
```

> Cada fila define: "la práctica X usa el parámetro Y, con rango de referencia [low, high] o texto referencia_text".

---

### 1.4 `lab_practice_config` — overrides por laboratorio

```sql
CREATE TABLE lab_practice_config (
  id                  bigint PRIMARY KEY,
  lab_id              bigint NOT NULL,
  practice_id         bigint NOT NULL REFERENCES practice(id),
  methodology         text,                -- sobreescribe practice.methodology
  reference_value     text,                -- sobreescribe practice.reference_value
  notes               text,
  default_observation text,                -- se autocompletá en el informe
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (lab_id, practice_id)
);
```

---

### 1.5 `order_practice` — línea de orden (snapshot en el momento de creación)

```sql
CREATE TABLE order_practice (
  id                   bigint PRIMARY KEY,
  order_id             bigint NOT NULL REFERENCES "order"(id),
  practice_id          bigint REFERENCES practice(id),  -- NULL si práctica eliminada
  nbu_code_snapshot    text NOT NULL,
  name_snapshot        text NOT NULL,
  units_snapshot       numeric NOT NULL,
  ub_value_snapshot    numeric NOT NULL,
  price_particular     numeric NOT NULL,
  price_insurer        numeric NOT NULL,
  patient_copay        numeric NOT NULL DEFAULT 0,
  authorization_status authorization_status NOT NULL DEFAULT 'no_aplica',
  authorization_code   text,
  include_in_report    boolean NOT NULL DEFAULT true,
  sort_order           integer NOT NULL DEFAULT 0,
  created_at           timestamptz NOT NULL DEFAULT now()
);
```

> **Trigger PG:** impide `UPDATE` en columnas snapshot (`nbu_code_snapshot`, `name_snapshot`, `units_snapshot`, `ub_value_snapshot`, `price_particular`, `price_insurer`).

---

### 1.6 `result` — resultado principal por línea de orden

```sql
CREATE TABLE result (
  id                   bigint PRIMARY KEY,
  order_practice_id    bigint NOT NULL REFERENCES order_practice(id),
  value_numeric        numeric,
  value_text           text,
  unit                 text,
  reference_range_low  numeric,
  reference_range_high numeric,
  flag                 result_flag,     -- 'normal' | 'low' | 'high' | 'critical'
  methodology          text,
  notes                text,
  entered_by           uuid NOT NULL,
  entered_at           timestamptz NOT NULL DEFAULT now(),
  reviewed_by          uuid,
  reviewed_at          timestamptz
);
```

---

### 1.7 `order_practice_unidad_value` — valor por sub-componente

```sql
CREATE TABLE order_practice_unidad_value (
  id                       bigint PRIMARY KEY,
  order_practice_id        bigint NOT NULL REFERENCES order_practice(id),
  unidad_id                bigint NOT NULL,
  unidad_nombre_snapshot   text NOT NULL,
  unidad_simbolo_snapshot  text,
  value_numeric            numeric,
  value_text               text,
  notes                    text,
  entered_by               uuid NOT NULL,
  entered_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now()
);
```

---

### Diagrama de relaciones (resumen)

```
practice ──────────────────── self-ref (parent_id)
    │
    ├── practice_unidad ───── unidad_medida
    │       └── range_low / range_high / reference_text (por par práctica×unidad)
    │
    └── lab_practice_config  (overrides por lab: methodology, referenceValue, etc.)
    
order ──── order_practice ─── result                  (valor principal)
                │
                └── order_practice_unidad_value        (valores por sub-componente)
```

---

## 2. Datos de Ejemplo

### 2.1 Prácticas con sub-prácticas (`parent_id`) — Compuestas tipo "panel"

| id   | nbu_code | name                            | child_count |
|------|----------|---------------------------------|-------------|
| 219  | 660481   | HEPATOGRAMA                     | 4           |
| 243  | 660546   | IONOGRAMA sérico                | 3           |
| 2922 | 00016    | Efluentes                       | 8           |
| 112  | 660192   | CREATININA en sangre            | 1           |
| 191  | 660413   | GLUCEMIA, PRUEBA DE SOBRECARGA  | 1           |

**Ejemplo — HEPATOGRAMA (id=219):**

| id  | nbu_code | name                                           | units |
|-----|----------|------------------------------------------------|-------|
| 62  | 660110   | BILIRRUBINEMIA TOTAL, DIRECTA E INDIRECTA      | 2.00  |
| 166 | 660357   | FOSFATASA ALCALINA (FAL)                       | 1.50  |
| 371 | 660873   | TRANSAMINASA, GLUTAMICO OXALACETICA (GOT/AST)  | 1.50  |
| 372 | 660874   | TRANSAMINASA, GLUTAMICO PIRUVICA (GPT/AGT)     | 1.50  |

> Cada hijo tiene su propia `nbu_code`, `units` y `precio_particular`. Al agregar HEPATOGRAMA a una orden, `expandWithChildren()` los agrega como líneas separadas (`order_practice`).

---

### 2.2 Prácticas con `unidad_medida` — Compuestas tipo "perfil multi-parámetro"

Las prácticas más complejas (p.ej. Orina Completa, Urocultivo, Hemograma) tienen sub-parámetros definidos en `practice_unidad`. Cada uno aparece como fila individual en el formulario de carga y en el informe.

**Ejemplo — ORINA COMPLETA (id=297, nbu_code=660711):**

| nombre         | simbolo | range_low | range_high | reference_text |
|----------------|---------|-----------|------------|----------------|
| Color          | —       | —         | —          | —              |
| Densidad       | —       | —         | —          | —              |
| PH             | —       | —         | —          | —              |
| Proteína       | —       | —         | —          | —              |
| Glucosa        | —       | —         | —          | —              |
| Cetonas        | —       | —         | —          | —              |
| Leucocitos     | —       | —         | —          | —              |
| Urobilinogenos | —       | —         | —          | —              |
| Nitritos       | —       | —         | —          | —              |

**Prácticas con mayor cantidad de unidades_medida:**

| id   | nbu_code           | name                        | unidades |
|------|--------------------|-----------------------------|----------|
| 386  | 660911             | UROCULTIVO (MODULO)         | 42       |
| 2911 | ACT-ESPERMOCULTIVO | Espermocultivo              | 27       |
| 2917 | 000012             | FISICOQUIMICO               | 19       |
| 107  | 660187             | COPROCULTIVO                | 18       |
| 2912 | ACT-FROTIS-SP      | Frotis de sangre periférica | 16       |

---

### 2.3 Ejemplo de `lab_practice_config`

| lab_id | practice                    | methodology              | reference_value    |
|--------|-----------------------------|--------------------------|-------------------|
| 3      | HEPATOGRAMA                 | esta es una metodologia  | —                 |
| 3      | PEROXIDASA TIROIDEO (TPO)   | Quimioluminiscencia      | hasta 13.8 IU/mL  |
| 3      | ANTICUERPOS ANTITIROGLOBULINA | Quimioluminiscencia    | Hasta 4.5 UI/ml   |
| 6      | HEMOGRAMA                   | —                        | va                |
| 6      | UROCULTIVO (MODULO)         | —                        | —                 |

---

## 3. Código Relevante

### 3.1 `practices.service.ts` — Lógica principal

**`search()` — buscador para agregar a órdenes**

```typescript
async search(query: string, limit = 50, section?: string): Promise<PracticeWithChildren[]> {
  const filters = [eq(practice.active, true), isNull(practice.parentId)];  // solo raíces
  if (section) filters.push(eq(practice.section, section));
  if (query) {
    const like = `%${query}%`;
    filters.push(or(ilike(practice.name, like), ilike(practice.nbuCode, like)));
  }
  const rows = await this.db.select().from(practice)
    .where(and(...filters)).orderBy(asc(practice.name)).limit(limit);
  return this.hydrateChildren(rows);
}
```

> **Restricción:** `isNull(practice.parentId)` — solo las raíces son buscables. Las subprácticas (`parent_id IS NOT NULL`) nunca aparecen solas en el selector de órdenes.

**`hydrateChildren()` — adjunta hijos a cada raíz**

```typescript
private async hydrateChildren(parents: Practice[]): Promise<PracticeWithChildren[]> {
  if (parents.length === 0) return [];
  const parentIds = parents.map((p) => p.id);
  const childRows = await this.db.select({ id, nbuCode, name, parentId })
    .from(practice)
    .where(and(inArray(practice.parentId, parentIds), eq(practice.active, true)))
    .orderBy(asc(practice.name));

  const childrenByParentId = new Map<number, Pick<Practice, 'id' | 'nbuCode' | 'name'>[]>();
  for (const c of childRows) {
    const list = childrenByParentId.get(c.parentId!) ?? [];
    list.push({ id: c.id, nbuCode: c.nbuCode, name: c.name });
    childrenByParentId.set(c.parentId!, list);
  }
  return parents.map((p) => ({ ...p, children: childrenByParentId.get(p.id) ?? [] }));
}
```

---

### 3.2 `orders.service.ts` — Expansión al crear una orden

**`expandWithChildren()` — expande subprácticas**

```typescript
async expandWithChildren(dtoPractices: OrderPracticeInputDto[]): Promise<OrderPracticeInputDto[]> {
  const parentIds = dtoPractices.map((p) => p.practiceId);
  const children = await this.db.select().from(practice)
    .where(and(inArray(practice.parentId, parentIds), eq(practice.active, true)));

  const alreadyIncluded = new Set(parentIds);
  const extra: OrderPracticeInputDto[] = [];
  let sortIdx = dtoPractices.length;

  for (const child of children) {
    if (!alreadyIncluded.has(child.id)) {
      alreadyIncluded.add(child.id);
      extra.push({ practiceId: child.id, sortOrder: sortIdx++, includeInReport: true });
    }
  }
  return [...dtoPractices, ...extra];
}
```

> **Importante:** Solo expande un nivel. Si un hijo también tiene hijos, **no se expanden recursivamente** (diseño actual).

---

### 3.3 Pricing — `src/domain/pricing/pricing.ts`

```typescript
const hasFixedPrice = p.precioParticular != null && p.precioParticular !== '';
const priceParticular = hasFixedPrice
  ? toMoneyString(new Decimal(p.precioParticular!))
  : multiplyMoney(p.units, ubParticular);

const priceInsurer = hasFixedPrice
  ? ZERO                                    // OS = $0 cuando hay precio fijo
  : multiplyMoney(p.units, ubInsurer);
```

> Cada subpráctica (hijo) se pricifica individualmente. El padre puede tener `units` globales pero el precio real emerge de la suma de los hijos en el frontend.

---

### 3.4 PDF — `src/pdf/render.tsx` + `informe.tsx`

El informe agrupa por `order_practice`. Cada práctica (raíz o hijo) se renderiza como un bloque `EstudioBlock` independiente.

**Lógica de render por práctica:**

```typescript
// render.tsx — para cada order_practice:
const hasUnidades = r.unidades && r.unidades.length > 0;

// EstudioBlock — informe.tsx:
{hasUnidades && r.value ? (
  // Muestra valor principal (ej. "Sedimento: Escasas células")
  <Text>{r.value}</Text>
) : null}

{hasUnidades ? (
  // Muestra filas de sub-unidades
  r.unidades.map(u => <UnidadRow key={u.id} u={u} />)
) : (
  // Muestra resultado simple (valueNumeric / valueText)
  <SimpleResultRow r={r} />
)}

{r.referenceValue ? (
  // Valor de referencia (siempre, sin importar si tiene unidades)
  r.referenceValue.split('\n').map((line, i) => <Text key={i}>{line}</Text>)
) : null}
```

---

### 3.5 Frontend — `PracticeHierarchySection`

El componente en `/practicas/[id]` permite gestionar la jerarquía padre-hijo:

- **Si la práctica tiene `parentId`**: muestra "Es subpráctica de [nombre padre]" + botón para quitar.
- **Si la práctica es raíz**: muestra lista de hijos actuales + buscador para agregar más.

La asignación se hace vía `PATCH /practices/{childId}` con `{ parentId: X }`.

---

### 3.6 Frontend — `PracticeUnidadesSection`

Gestiona la relación M:N práctica ↔ unidad_medida vía `UnidadesDialog`:

- Lista todas las `unidad_medida` del catálogo.
- Toggle para agregar/quitar de la práctica actual.
- Editor inline para `rangeLow`, `rangeHigh`, `referenceText`, `opcionesPredeterminadas`.
- Reordenamiento con flechas (actualiza `sort_order`).

API calls:
```
GET    /practices/{id}/unidades         → lista actual
POST   /practices/{id}/unidades         → agregar { unidadId }
DELETE /practices/{id}/unidades/{uid}   → quitar
PATCH  /practices/{id}/unidades/{uid}   → editar rangeLow/rangeHigh/referenceText
GET    /unidades-medida?limit=500       → catálogo completo
POST   /unidades-medida                 → crear nueva
PATCH  /unidades-medida/{id}            → editar nombre/símbolo/opciones
```

---

## 4. Volumen (producción al 2026-08-10)

| Entidad                        | Registros |
|--------------------------------|----------:|
| `practice` total               | 1.472     |
| `practice` raíces activas      | 1.387     |
| `practice` hijos (subprácticas)| 17        |
| `unidad_medida`                | 211       |
| `practice_unidad` (pivots)     | 262       |
| `lab_practice_config`          | 49        |
| `order` total                  | 84        |
| `order_practice`               | 623       |
| `result` (valores principales) | 413       |
| `order_practice_unidad_value`  | 513       |

---

## 5. Dos Modelos de Complejidad

El sistema tiene **dos mecanismos distintos** para modelar prácticas con sub-elementos:

### Modelo A — `parent_id` (subprácticas como filas independientes)

**Cuándo:** La subpráctica es una práctica NBU con código, UBs y precio propios.  
**Ejemplo:** HEPATOGRAMA contiene BILIRRUBINEMIA, FOSFATASA, GOT, GPT.

- Cada hijo es una `practice` separada, buscable, preciable y facturable individualmente.
- Al agregar el padre, `expandWithChildren()` agrega todos los hijos como líneas de `order_practice`.
- Cada hijo tiene su propio `result` (valor principal) y puede tener sus propias `order_practice_unidad_value`.
- En el informe, el padre puede aparecer como encabezado o no aparecer si `include_in_report = false`.

### Modelo B — `practice_unidad` (sub-parámetros como componentes del resultado)

**Cuándo:** Los sub-parámetros no son prácticas NBU separadas; son magnitudes del mismo estudio.  
**Ejemplo:** ORINA COMPLETA tiene Color, Densidad, pH, Proteína, Glucosa, Cetonas, etc.

- Los sub-parámetros no tienen `nbu_code` propio ni precio individual.
- Se configuran en `practice_unidad` (pivot) con rangos de referencia y orden visual.
- Los valores ingresados van a `order_practice_unidad_value` (no a `result`).
- El valor principal de la práctica (`result.value_text`) puede coexistir (ej. "Sedimento: Escasas células...").

---

## 6. Gaps Identificados para "Prácticas Compuestas"

### 6.1 Hemograma — no está modelado actualmente

HEMOGRAMA (id=213, nbu_code=660475) **no tiene hijos** (parent_id) ni unidades_medida configuradas en producción. Los valores (GB, GR, Hb, Hcto, VCM, HCM, CHCM, plaquetas, etc.) no tienen una estructura formal — se cargan como texto libre en `result.value_text`.

Para modelarlo como práctica compuesta habría que elegir:
- **Opción A (parent_id):** Crear cada determinación (GB, GR, Hb...) como subpráctica con su nbuCode propio, y vincularlas como hijos de HEMOGRAMA. Ventaja: cada uno tiene precio y resultado individual. Desventaja: son ~8-10 prácticas NBU nuevas.
- **Opción B (practice_unidad):** Crear unidades_medida para GB (×10³/μL), GR (×10⁶/μL), Hb (g/dL), etc. y asociarlas a HEMOGRAMA. Ventaja: no genera nuevas prácticas facturables. Desventaja: no hay precio individual por parámetro.

### 6.2 Limitación: solo se expande un nivel

`expandWithChildren()` es **no recursivo**. Si se quisiera modelar un "panel" que contiene paneles, no funciona. Para Hemograma simple (1 nivel) es suficiente.

### 6.3 Visibilidad en el informe

Hoy el padre se renderiza como cualquier otra práctica. Si el padre es solo un "contenedor" (ej. HEPATOGRAMA como encabezado), se puede setear `include_in_report = false` en la línea del padre al crear la orden, mostrando solo los hijos.

### 6.4 `condicion_visibilidad` y `reference_value_template`

Campos JSON en `practice` sin uso funcional documentado. Podrían ser el punto de extensión para reglas de visibilidad condicional de sub-parámetros (ej. "mostrar Sedimento solo si Leucocitos > 10").

---

## 7. Flujo Completo (Modelo A — parent_id)

```
1. Usuario busca "HEPATOGRAMA" en el selector de órdenes
   → GET /practices?q=hepatograma
   → service.search() filtra isNull(parentId) → devuelve HEPATOGRAMA con children[]

2. Usuario lo agrega → POST /orders
   → expandWithChildren() detecta hijos: BILIRRUBINEMIA, FAL, GOT, GPT
   → crea order_practice para HEPATOGRAMA + 4 hijos (5 filas)

3. Usuario carga resultados
   → POST/PATCH /results  (uno por cada order_practice)
   → HEPATOGRAMA puede tener result.value_text = null (solo contenedor)

4. Informe PDF
   → render.tsx arma InformeResultRow por cada order_practice
   → EstudioBlock renderiza cada uno
   → HEPATOGRAMA aparece como bloque vacío (o no aparece si include_in_report=false)
   → Hijos aparecen como bloques individuales con sus valores
```

---

## 8. Flujo Completo (Modelo B — practice_unidad)

```
1. Usuario busca "ORINA COMPLETA"
   → GET /practices?q=orina completa
   → search() devuelve ORINA COMPLETA sin children (no tiene parent_id)
   → pero tiene practice_unidad configuradas (Color, Densidad, pH, ...)

2. Usuario la agrega → POST /orders
   → expandWithChildren() no detecta hijos → solo crea 1 order_practice

3. Usuario carga resultados
   → formulario de carga muestra las unidades de la práctica
   → GET /practices/297/unidades → [Color, Densidad, pH, ...]
   → POST /results  (valor principal: "Sedimento: Escasas células…")
   → POST /order-practices/{id}/unidad-values  (uno por unidad: Color=Amarillo, pH=6, ...)

4. Informe PDF
   → render.tsx consulta order_practice_unidad_value para la práctica
   → hasUnidades = true → renderiza filas de sub-parámetros
   → si hay result.value_text, se muestra primero como bloque principal
   → se listan las unidades debajo
```
