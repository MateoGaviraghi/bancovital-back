# 04 — Esquema de base de datos

Base: Postgres 16 (Supabase managed). ORM: Drizzle.

## Resumen

13 tablas + 7 enums + 1 sequence (`seq_protocol`).

## Enums

```typescript
// src/db/schema/enums.ts
import { pgEnum } from 'drizzle-orm/pg-core';

export const patientSexEnum = pgEnum('patient_sex', ['F', 'M', 'X']);
export const userRoleEnum = pgEnum('user_role', ['admin', 'recepcion', 'bioquimico']);
export const orderOriginEnum = pgEnum('order_origin', ['ambulatorio', 'internacion', 'urgencia']);
export const orderStatusEnum = pgEnum('order_status', [
  'borrador', 'confirmada', 'en_proceso', 'resultados_cargados', 'emitida', 'entregada', 'anulada',
]);
export const authorizationStatusEnum = pgEnum('authorization_status', [
  'no_aplica', 'pendiente', 'autorizada', 'rechazada',
]);
export const resultFlagEnum = pgEnum('result_flag', [
  'normal', 'low', 'high', 'critical_low', 'critical_high',
]);
export const paymentMethodEnum = pgEnum('payment_method', [
  'efectivo', 'debito', 'credito', 'transferencia', 'mp', 'cuenta_corriente',
]);
export const attachmentKindEnum = pgEnum('attachment_kind', [
  'prescripcion', 'autorizacion', 'dni', 'otros',
]);
```

## Tablas

### user

Mirror local de `auth.users` de Supabase. UUID = mismo que el auth.

| Columna | Tipo | Nullable | Default |
|---|---|---|---|
| id | uuid | NO | (PK, viene de auth.users) |
| email | text | NO | UNIQUE |
| display_name | text | YES | |
| role | user_role enum | NO | |
| matricula | text | YES | (solo bioquímicos) |
| active | boolean | NO | true |
| created_at | timestamptz | NO | now() |

### patient

| Columna | Tipo | Nullable | Default |
|---|---|---|---|
| id | bigint | NO | sequence patient_id_seq (PK) |
| dni | text | NO | |
| first_name | text | NO | |
| last_name | text | NO | |
| sex | patient_sex enum | YES | |
| birth_date | date | NO | |
| phone | text | YES | |
| email | text | YES | |
| street_address | text | YES | |
| city | text | YES | |
| notes | text | YES | |
| created_by | uuid | YES | FK → user.id |
| created_at | timestamptz | NO | now() |
| updated_at | timestamptz | NO | now() |
| deleted_at | timestamptz | YES | (soft delete) |

Indexes:
- `idx_patient_dni_active`: UNIQUE (dni) WHERE deleted_at IS NULL
- `idx_patient_email`: (email)
- `idx_patient_lastname_trgm`: GIN (last_name gin_trgm_ops)

### doctor

| Columna | Tipo | Nullable | Default |
|---|---|---|---|
| id | bigint | NO | sequence (PK) |
| first_name | text | NO | |
| last_name | text | NO | |
| matricula | text | NO | |
| specialty | text | YES | |
| phone | text | YES | |
| email | text | YES | |
| notes | text | YES | |
| created_by | uuid | YES | FK → user.id |
| created_at | timestamptz | NO | now() |
| updated_at | timestamptz | NO | now() |
| deleted_at | timestamptz | YES | |

Indexes:
- `idx_doctor_matricula_active`: UNIQUE (matricula) WHERE deleted_at IS NULL
- `idx_doctor_lastname_trgm`: GIN (last_name gin_trgm_ops)

### insurer

| Columna | Tipo | Nullable | Default |
|---|---|---|---|
| id | bigint | NO | sequence (PK) |
| code | text | NO | UNIQUE |
| name | text | NO | |
| requires_authorization | boolean | NO | true |
| active | boolean | NO | true |
| created_at | timestamptz | NO | now() |
| updated_at | timestamptz | NO | now() |

### ub_value

Valor de la unidad bioquímica (UB) por obra social, time-ranged.

| Columna | Tipo | Nullable | Default |
|---|---|---|---|
| id | bigint | NO | sequence (PK) |
| insurer_id | bigint | NO | FK → insurer.id |
| valid_from | date | NO | |
| valid_to | date | YES | (NULL = vigente actual) |
| value | numeric(12,2) | NO | |
| notes | text | YES | |
| created_by | uuid | YES | FK → user.id |
| created_at | timestamptz | NO | now() |

Indexes:
- `idx_ubvalue_current_per_insurer`: UNIQUE (insurer_id) WHERE valid_to IS NULL

### practice

Catálogo NBU. Cada práctica tiene unidades UB y opcionalmente un template de rangos de referencia.

| Columna | Tipo | Nullable | Default |
|---|---|---|---|
| id | bigint | NO | sequence (PK) |
| nbu_code | text | NO | UNIQUE |
| name | text | NO | |
| short_name | text | YES | |
| category | text | YES | |
| section | text | YES | |
| units | numeric(8,2) | NO | (UB units) |
| requires_authorization | boolean | NO | false |
| reference_value_template | jsonb | YES | (ReferenceValueTemplate) |
| is_special_act | boolean | NO | false |
| active | boolean | NO | true |
| created_at | timestamptz | NO | now() |
| updated_at | timestamptz | NO | now() |

Indexes:
- `idx_practice_nbucode`: UNIQUE (nbu_code)
- `idx_practice_active_section`: (active, section)
- `idx_practice_name_trgm`: GIN (name gin_trgm_ops)

### order

Tabla principal. Snapshot de precios + paciente + obra social.

| Columna | Tipo | Nullable | Default |
|---|---|---|---|
| id | bigint | NO | sequence (PK) |
| protocol_number | bigint | NO | nextval('seq_protocol'), UNIQUE |
| patient_id | bigint | NO | FK → patient.id (restrict) |
| insurer_id | bigint | NO | FK → insurer.id (restrict) |
| insurance_affiliate_number | text | YES | |
| referring_doctor_id | bigint | YES | FK → doctor.id (set null) |
| referring_doctor_name | text | YES | (snapshot) |
| referring_doctor_mp | text | YES | (snapshot) |
| diagnosis | text | YES | |
| origin | order_origin | NO | |
| order_date | timestamptz | NO | now() |
| status | order_status | NO | 'borrador' |
| is_urgent | boolean | NO | false |
| notes | text | YES | |
| total_particular | numeric(12,2) | NO | '0.00' |
| total_insurer | numeric(12,2) | NO | '0.00' |
| total_patient_copay | numeric(12,2) | NO | '0.00' |
| ub_value_used | numeric(12,2) | NO | (snapshot) |
| pdf_report_path | text | YES | (Storage path) |
| pdf_report_issued_at | timestamptz | YES | |
| pdf_report_signed_by | uuid | YES | FK → user.id |
| created_by | uuid | YES | FK → user.id |
| created_at | timestamptz | NO | now() |
| updated_at | timestamptz | NO | now() |

Indexes:
- `idx_order_protocol`: UNIQUE (protocol_number)
- `idx_order_patient_date`: (patient_id, order_date)
- `idx_order_status_date`: (status, order_date)

### order_practice

Líneas de la orden. **Snapshots inmutables** de precio y nombre.

| Columna | Tipo | Nullable | Default |
|---|---|---|---|
| id | bigint | NO | sequence (PK) |
| order_id | bigint | NO | FK → order.id (cascade) |
| practice_id | bigint | YES | FK → practice.id (restrict) |
| nbu_code_snapshot | text | NO | |
| name_snapshot | text | NO | |
| units_snapshot | numeric(8,2) | NO | |
| ub_value_snapshot | numeric(12,2) | NO | |
| price_particular | numeric(12,2) | NO | |
| price_insurer | numeric(12,2) | NO | |
| patient_copay | numeric(12,2) | NO | '0.00' |
| authorization_status | authorization_status | NO | 'no_aplica' |
| authorization_code | text | YES | |
| include_in_report | boolean | NO | true |
| sort_order | int | NO | 0 |
| created_at | timestamptz | NO | now() |

Indexes:
- `idx_order_practice_order`: (order_id)

### result

Un result por order_practice (relación 1:1).

| Columna | Tipo | Nullable | Default |
|---|---|---|---|
| id | bigint | NO | sequence (PK) |
| order_practice_id | bigint | NO | FK (cascade), UNIQUE |
| value_numeric | numeric(20,6) | YES | |
| value_text | text | YES | |
| unit | text | YES | |
| reference_range_low | numeric(20,6) | YES | |
| reference_range_high | numeric(20,6) | YES | |
| flag | result_flag | YES | |
| methodology | text | YES | |
| notes | text | YES | |
| entered_by | uuid | NO | FK → user.id |
| entered_at | timestamptz | NO | now() |
| reviewed_by | uuid | YES | FK → user.id |
| reviewed_at | timestamptz | YES | |

### payment

| Columna | Tipo | Nullable | Default |
|---|---|---|---|
| id | bigint | NO | sequence (PK) |
| order_id | bigint | NO | FK (cascade) |
| method | payment_method | NO | |
| amount | numeric(12,2) | NO | |
| reference | text | YES | |
| created_by | uuid | NO | FK → user.id |
| created_at | timestamptz | NO | now() |

Indexes: `idx_payment_order` (order_id)

### attachment

| Columna | Tipo | Nullable | Default |
|---|---|---|---|
| id | bigint | NO | sequence (PK) |
| order_id | bigint | NO | FK (cascade) |
| kind | attachment_kind | NO | |
| storage_path | text | NO | |
| mime_type | text | NO | |
| size_bytes | bigint | NO | |
| uploaded_by | uuid | NO | FK → user.id |
| uploaded_at | timestamptz | NO | now() |

Indexes: `idx_attachment_order` (order_id)

### audit_log

Append-only. RLS restringido.

| Columna | Tipo | Nullable | Default |
|---|---|---|---|
| id | bigint | NO | sequence (PK) |
| actor_id | uuid | YES | FK → user.id |
| action | text | NO | (CREATE/UPDATE/DELETE/etc.) |
| entity | text | NO | (order/patient/result/...) |
| entity_id | text | NO | |
| before | jsonb | YES | |
| after | jsonb | YES | |
| ip | inet | YES | |
| user_agent | text | YES | |
| created_at | timestamptz | NO | now() |

Indexes:
- `idx_audit_actor_created`: (actor_id, created_at)
- `idx_audit_entity`: (entity, entity_id)

### lab_config

Singleton (una sola fila en V1).

| Columna | Tipo | Nullable | Default |
|---|---|---|---|
| id | bigint | NO | sequence (PK) |
| legal_name | text | NO | |
| cuit | text | NO | |
| street_address | text | NO | |
| city | text | NO | 'Santa Fe' |
| province | text | NO | 'Santa Fe' |
| phone | text | YES | |
| email | text | YES | |
| signing_professional_name | text | NO | |
| signing_professional_mp | text | NO | |
| signing_signature_path | text | YES | |
| logo_url | text | YES | (URL pública) |
| short_name | text | YES | |
| created_at | timestamptz | NO | now() |
| updated_at | timestamptz | NO | now() |

## RLS (Row Level Security)

Política general:
- `audit_log`: solo admin lee. Nadie modifica (los inserts vienen de triggers).
- Resto: cada usuario autenticado puede leer/escribir según su rol. Las verificaciones reales están en los Guards de NestJS; RLS es defense in depth.

## Sequences

```sql
CREATE SEQUENCE seq_protocol START 1;
-- Cada order.protocol_number toma el siguiente valor automáticamente.
```

## Extensiones requeridas

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;     -- Para GIN indexes en búsquedas
CREATE EXTENSION IF NOT EXISTS pgcrypto;    -- gen_random_uuid()
```

## Cómo aplicar el schema

1. Definir todas las tablas en `src/db/schema/*.ts` con Drizzle
2. Correr `pnpm db:generate` → genera SQL en `src/db/migrations/`
3. Aplicar manualmente la primera migration en Supabase SQL Editor (o `pnpm db:push` en dev)
4. A partir de ahí, cada cambio: editar schema → `db:generate` → revisar SQL → aplicar

## Cliente Drizzle

`src/db/client.ts`:

```typescript
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

const client = postgres(process.env.DATABASE_URL!, {
  max: 10,
  idle_timeout: 30,
});

export const db = drizzle(client, { schema: {} });
export type Db = typeof db;
```

`src/db/admin.ts` (Supabase admin):

```typescript
import { createClient, SupabaseClient } from '@supabase/supabase-js';

let cached: SupabaseClient | undefined;

export function getAdminClient(): SupabaseClient {
  if (cached) return cached;
  cached = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  return cached;
}
```
