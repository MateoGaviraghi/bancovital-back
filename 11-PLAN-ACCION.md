# 11 — Plan de acción

Orden de tareas para construir `lab-back` desde cero. Estimado total: **3-5 días** trabajando full time.

## FASE 0 — Infraestructura externa (1 hora)

1. Crear repo en GitHub: `lab-back` (privado).
2. Asegurarte de tener acceso al proyecto Supabase del laboratorio.
3. Crear proyecto en Railway (después del primer commit).

## FASE 1 — Setup base (medio día)

Seguir el archivo **02-SETUP.md** punto por punto.

- [ ] `nest new lab-back`
- [ ] Instalar deps de `01-STACK.md`
- [ ] Configurar TypeScript paths (`@/*`)
- [ ] Configurar Biome (lint + format)
- [ ] Crear estructura de carpetas
- [ ] Bootstrap mínimo: `main.ts` con Swagger, CORS, ValidationPipe, prefijo `/api`
- [ ] `HealthModule` con `/healthz`
- [ ] Verificar que arranca: `pnpm start:dev` → `http://localhost:4000/api/healthz`
- [ ] `git init`, primer commit, push a GitHub

**Salida:** repo vacío con NestJS arrancando.

## FASE 2 — Base de datos (1 día)

Seguir **04-DB-SCHEMA.md**.

- [ ] Configurar `drizzle.config.ts`
- [ ] Crear `src/db/client.ts` con conexión postgres
- [ ] Crear `src/db/admin.ts` con cliente Supabase admin
- [ ] Definir enums en `src/db/schema/enums.ts`
- [ ] Definir cada tabla en su archivo:
  - [ ] `user.ts`
  - [ ] `patient.ts`
  - [ ] `doctor.ts`
  - [ ] `insurer.ts`
  - [ ] `ub-value.ts`
  - [ ] `practice.ts`
  - [ ] `order.ts`
  - [ ] `order-practice.ts`
  - [ ] `result.ts`
  - [ ] `payment.ts`
  - [ ] `attachment.ts`
  - [ ] `audit-log.ts`
  - [ ] `lab-config.ts`
- [ ] `pnpm db:generate` → revisar SQL generado
- [ ] Aplicar SQL en Supabase (vía dashboard SQL Editor o `pnpm db:push`)
- [ ] Insertar la fila inicial de `lab_config`
- [ ] Insertar `insurer` "PARTICULAR" y algunas obras sociales (IAPOS, etc.)
- [ ] Crear `seq_protocol` y las extensiones (`pg_trgm`, `pgcrypto`)

**Salida:** schema completo en Supabase, queries básicas funcionan.

## FASE 3 — Autenticación (medio día)

Seguir **07-AUTH.md**.

- [ ] `src/auth/session.ts` con types `Session` y `UserRole`
- [ ] `src/auth/verify.ts` con `verifyAuthHeader()`
- [ ] `src/common/guards/auth.guard.ts` (`AuthGuard`)
- [ ] `src/common/guards/roles.guard.ts` (`RolesGuard`)
- [ ] `src/common/decorators/roles.decorator.ts` (`@Roles()`)
- [ ] `src/common/decorators/current-user.decorator.ts` (`@CurrentUser()`)
- [ ] Filtro global de excepciones (opcional pero recomendado)
- [ ] Test manual: protected endpoint sin Bearer token → 401

**Salida:** middleware de auth funcionando.

## FASE 4 — Domain logic (medio día)

Seguir **08-DOMAIN.md**.

- [ ] `src/domain/money/money.ts` + tests
- [ ] `src/domain/status/status.ts` + tests
- [ ] `src/domain/validation/validation.ts` + tests
- [ ] `src/domain/pricing/pricing.ts` + tests (NBU engine con special acts)

**Salida:** lógica pura testeada al 100%.

## FASE 5 — Módulos del catálogo (1 día)

Implementar lectura-pesada primero (más simple).

- [ ] **PatientsModule**: search, byId, create, update
- [ ] **DoctorsModule**: search, byId, create, update, delete
- [ ] **InsurersModule**: list, listWithCurrentUb, byId, create, update, setActive
- [ ] **UbValuesModule** (parte de Insurers): setUbValue (con transacción)
- [ ] **PracticesModule**: search, list, byIds
- [ ] **LabConfigModule**: get, update

**Salida:** todos los CRUD de catálogo funcionan.

## FASE 6 — Órdenes (1-2 días, más complejo)

- [ ] **OrdersModule**:
  - [ ] DTOs: `CreateOrderDto`, `OrderFiltersDto`, `CancelOrderDto`
  - [ ] Service: `create()` con transacción (resolveUbs → pricing → snapshot)
  - [ ] Service: `list()` con filtros
  - [ ] Service: `byId()` con join paciente + insurer
  - [ ] Service: `lines()` con snapshots
  - [ ] Service: `confirm()`, `cancel()`, `finalize()` con FSM
- [ ] Test integración: crear → confirmar → cargar resultados → emitir

**Salida:** flujo de órdenes completo end-to-end (sin PDF aún).

## FASE 7 — Resultados (medio día)

- [ ] **ResultsModule**:
  - [ ] DTO: `UpsertResultDto`
  - [ ] Service: `byOrder()` con metadata + rangos
  - [ ] Service: `upsert()` con cálculo de flag desde `pickRangeRule` + `classifyResult`
  - [ ] Service: `finalize()` (calls Orders.finalize)

**Salida:** carga de resultados con clasificación automática.

## FASE 8 — PDF + Reports (1 día)

Seguir **09-PDF.md**.

- [ ] Crear bucket `reports` en Supabase Storage (privado)
- [ ] `src/pdf/render.tsx` con `renderInformePdf()`
- [ ] `src/pdf/templates/informe.tsx` con el template JSX completo
- [ ] **ReportsModule**:
  - [ ] Service: `emit()` (render + upload + markEmitted)
  - [ ] Service: `signedUrl()` con self-healing
  - [ ] Service: `regenerateAll()` (admin)

**Salida:** PDF se genera y descarga firmado.

## FASE 9 — Usuarios (admin) (medio día)

- [ ] **UsersModule**:
  - [ ] Service: `list()` con Supabase admin + merge public.user
  - [ ] Service: `invite()` con magic link + role en app_metadata
  - [ ] Service: `setRole()` con bloqueo self-demotion
  - [ ] Service: `setActive()` con ban_duration
- [ ] Verificar que el role en JWT funciona end-to-end

**Salida:** admin puede invitar y gestionar devs/recepcionistas.

## FASE 10 — Deploy (medio día)

Seguir **10-DEPLOY.md**.

- [ ] Crear `Dockerfile` en raíz
- [ ] Crear `railway.json` en raíz
- [ ] Conectar Railway al repo
- [ ] Setear todas las variables de entorno
- [ ] Primer deploy → verificar `/api/healthz` público
- [ ] Configurar dominio (opcional, Railway da uno por default)

**Salida:** API en producción.

## FASE 11 — Smoke tests + handoff (medio día)

- [ ] Probar todos los endpoints con curl o Postman/Insomnia
- [ ] Importar la colección OpenAPI (`/api/docs`) en Insomnia
- [ ] Crear un usuario admin de prueba en Supabase
- [ ] Crear orden de prueba end-to-end (back puro, sin front)
- [ ] Validar PDF se genera y baja correctamente

**Salida:** back listo para integrarse con el front.

## Checklist final pre-handoff

- [ ] Repo público de docs interno actualizado
- [ ] `.env.example` commiteado (sin secrets)
- [ ] README con instrucciones de setup
- [ ] CI básico (GitHub Actions: `pnpm typecheck && pnpm test`)
- [ ] Tests de domain logic verdes
- [ ] Swagger UI accesible
- [ ] Variables de entorno en Railway completas
- [ ] CORS configurado para el dominio del front
- [ ] Bucket `reports` creado en Supabase

## Errores comunes y soluciones

| Error | Causa | Solución |
|---|---|---|
| `ERR_PNPM_OUTDATED_LOCKFILE` | lockfile no coincide con package.json | `pnpm install` |
| `connection refused` al levantar | postgres no resuelve | revisar `DATABASE_URL`, usar pooler de Supabase |
| 401 en todos los endpoints | token mal armado | verificar `Authorization: Bearer ...` |
| 403 en endpoint protegido | rol incorrecto | revisar `app_metadata.role` del usuario en Supabase |
| Build de Docker falla en Railway | falta env var | revisar Variables del servicio en Railway |
| PDF crashea al renderizar | falta `lab_config` row | insertar fila inicial en `lab_config` |

## Cuando todo esté listo

→ Pasar a construir el **front** siguiendo los archivos en `C:\Users\mateo\Desktop\lab-front\`.
