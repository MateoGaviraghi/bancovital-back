# 12 — PLAN SAAS (BACK)

> Qué le toca al BACK (bancovital-back) en cada fase del plan maestro multi-tenant. El contrato API de cada fase lo define el líder técnico (chat del front) ANTES de implementar; el front espeja DTOs en `lib/api/types.ts`. Contraparte front: `bancovital-front/docs/PLAN-SAAS-FRONT.md`.
> Aprobado por Mateo el 2026-06-12. Decisiones cerradas: tenancy path-based por slug, firma propia con evidencia, rollover 1 mes, soft-block de cupo, portal paciente confirmado.

Base ya existente (no rehacer): tabla `laboratorio` con `slug` UNIQUE, `labId` FK en entidades core, `TenantService`, roles `super|admin|recepcion|bioquimico` con guards, invitaciones Supabase, PDFs de informes con `@react-pdf/renderer` + `preferencia_pdf`, Storage con signed URLs.

## Estado

| Fase | Estado |
|---|---|
| F1 Branding público + RLS | ✅ COMPLETA — en producción 2026-06-12. Migración 0006 aplicada; endpoint público de branding vivo en prod y en `bancovital-back-dev.up.railway.app` (servicio dev, branch dev, misma DB). RBAC operativo unificado. Gotcha aprendido: regla biome `useImportType` DESHABILITADA (rompe DI de Nest); spec `app.module.spec.ts` protege. RLS: políticas explícitas siguen pendientes (deny-by-default activo) |
| F2 Planes y cuotas | Pendiente |
| F3 Contratos + firma | Pendiente |
| F4 Landing | No participa |
| F5 Super power-ups | Pendiente |
| F6 Personalización admin | Pendiente |
| F7 Portal paciente | Pendiente |

## F1 — Branding público + hardening

- Columnas de branding en `laboratorio` (migración): `primary_color` (+ los campos visuales que falten; logo ya existe).
- `GET /api/public/labs/{slug}/branding` — PÚBLICO, sin auth: devuelve SOLO nombre, shortName, logo (signed/público), primary_color, tagline. Con **rate limiting** (no enumerable). 404 plano si no existe (sin filtrar info).
- Lista de slugs reservados al crear/editar lab: `super`, `login`, `auth`, `api`, `contratar`, `r`, paths de landing.
- **RLS hardening:** escribir políticas reales por tabla (hoy RLS habilitado sin políticas; el service role bypassea — defensa en profundidad). Enforcement primario sigue siendo code-level (`labId` del JWT).
- Roles: `recepcion` y `bioquimico` quedan con permisos operativos IDÉNTICOS (pacientes, médicos, órdenes, resultados, informes) — ajustar `@Roles()` donde difieran hoy. Precios/facturación/config/usuarios: solo `admin`.

## F2 — Planes y cuotas

- Tablas nuevas: `plan` (nombre, cupo_ordenes_mes, precio_mensual, precio_orden_excedente), `suscripcion` (labId, planId, estado, desde), `ciclo_consumo` (labId, período YYYY-MM, cupo_base, rollover_aplicado, usadas, excedentes).
- Lógica en creación de orden: incrementa contador del ciclo; cupo efectivo = cupo del plan + rollover vigente (**rollover = no usadas del mes anterior, vigencia 1 mes, después vencen**); pasado el cupo NO bloquea (**soft-block**) — marca la orden como excedente facturable.
- Notificaciones al 80% y 100% (al lab y a Nodo).
- Endpoints: super CRUD `/api/super/plans`, asignar plan a lab; lab `GET /api/consumo` (ciclo actual: usadas/cupo/rollover/excedentes).

## F3 — Contratos + firma propia

- Tabla `contrato`: datos del cliente, propuesta (JSONB), plan elegido, token único firmado con expiración **15 días**, estado (enviado/firmado/vencido), paths de PDF (original y firmado), evidencia (JSONB).
- Generador de PDF contrato con `@react-pdf/renderer` (mismo stack que informes), **template nuevo formal**: fuentes embebidas Source Serif 4 (títulos) + Public Sans (cuerpo, números tabulares), violeta Nodo `#8b2fef` solo como acento, cláusulas numeradas, página de firma con bloque de evidencia. NO portar la estética Helvetica de presupuestos-nodo.
- Cláusulas obligatorias: tratamiento de **datos sensibles de salud (Ley 25.326)** — lab responsable, Nodo encargado del tratamiento; confidencialidad; límites de responsabilidad. (Borrador nuestro, revisión única de abogado.)
- Endpoints públicos por token: `GET /api/public/contracts/{token}` (resumen + planes), `POST .../otp/request` y `POST .../otp/verify` (OTP al email del firmante), `POST .../sign` (firma dibujada en base64 + aceptación de cláusulas) → guarda evidencia: **hash SHA-256 del PDF, IP, user agent, timestamp, OTP verificado, firma**.
- Al firmar: **alta automática del laboratorio** (estado pendiente de onboarding) + suscripción al plan elegido + invitación al admin (`inviteUserByEmail`, flujo set-password existente) + notificación a Nodo.

## F5 — Super power-ups

- **Impersonation:** endpoint para que `super` obtenga contexto de un lab (resuelve el 403 de `requireLabId` de forma controlada) — cada acción impersonada queda en audit log.
- Tabla `audit_log` (quién, qué, cuándo, lab, impersonando o no) — el módulo trace conceptual que falta acá.
- **Export/backup por lab:** dump JSON/CSV de todos los datos del lab (recuperación, offboarding). Job + descarga vía signed URL.
- Métricas: endpoints agregados (órdenes/mes por lab, % uso de plan, labs activos).
- Estado de cuenta: tabla `pago` (manual: lab, monto, fecha, nota) + endpoints; suspensión usa el estado `suspendido` existente.
- Anuncios: tabla + endpoint (banner global o por lab).

## F6 — Personalización admin

- `PATCH` de branding por `admin` del propio lab (color primario, logo) — mismo dato que consume el endpoint público de F1.
- Sedes: tabla `sede` (labId, dirección, teléfono, horarios) + CRUD admin. Disponibles para el PDF y el portal.
- Extensiones a `preferencia_pdf` según necesidades del editor visual (firmas múltiples, bloques opcionales).

## F7 — Portal del paciente

- Token público por informe emitido (tabla o columna en el reporte): el QR impreso en el PDF del informe apunta a `/r/{token}`.
- `POST /api/public/reports/{token}/access` valida DNI del paciente → devuelve signed URL del PDF. Rate limit + expiración configurable + auditoría de accesos.

## Reglas transversales

- Toda tabla nueva con `labId` donde corresponda + soft-delete (`deletedAt`) + filtrado por tenant en TODAS las queries.
- Migraciones SIEMPRE `db:generate` + `db:migrate` (nunca `db:push` en branches compartidas — ya causó drift, ver gotcha en PROJECT-BRAIN).
- Endpoints públicos: rate limiting, errores planos sin filtrar existencia, tokens firmados con expiración.
- Dinero con Decimal.js (convención existente). TZ anchor intacto (`src/tz.ts` primer import).
