# lab-back — Plan de construcción

> Documentación completa para construir desde cero el backend del sistema de laboratorio.
> Stack: **NestJS + Drizzle ORM + Supabase + REST API**.

## Cómo usar esta carpeta

Esta carpeta **no contiene código**, solo planes y especificaciones. La idea es que vos (o tu compañero) sigan los archivos en orden y construyan el repo `lab-back` desde cero.

## Orden de lectura

1. **01-STACK.md** — Qué tecnologías usar y por qué.
2. **02-SETUP.md** — Cómo armar el proyecto NestJS desde cero.
3. **03-ENV.md** — Variables de entorno (qué van, dónde van).
4. **04-DB-SCHEMA.md** — Esquema completo de la base de datos.
5. **05-MODULES.md** — Estructura de módulos NestJS por dominio.
6. **06-ENDPOINTS-REST.md** — Todos los endpoints HTTP.
7. **07-AUTH.md** — Autenticación con Supabase JWT + Guards.
8. **08-DOMAIN.md** — Lógica de negocio (pricing, money, status, validación).
9. **09-PDF.md** — Generación de informes PDF.
10. **10-DEPLOY.md** — Deploy a Railway con Dockerfile.
11. **11-PLAN-ACCION.md** — Pasos ordenados para construir todo.

## Resumen del sistema

Sistema de gestión de laboratorio bioquímico. El back expone una API REST que el front (Next.js) consume. Maneja:

- Pacientes, médicos, obras sociales, prácticas (NBU)
- Órdenes con cálculo de precios por unidades bioquímicas (UB)
- Resultados con clasificación contra rangos de referencia
- Informes PDF firmados, guardados en Supabase Storage
- Autenticación + roles (admin / recepción / bioquímico) via Supabase Auth
- Auditoría y RLS en Postgres

## Cliente y reglas

- Cliente: laboratorio bioquímico en Santa Fe, Argentina
- Reglas no negociables:
  - Plata = `decimal.js`, NUNCA `Number`
  - UI en español, código en inglés
  - Cada endpoint con `AuthGuard` + `RolesGuard`
  - DTOs validados con `class-validator`
  - Migrations forward-only con Drizzle
  - PHI/PII NO en logs
