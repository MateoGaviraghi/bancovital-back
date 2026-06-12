# PROMPT — Pantalla de Catálogo de Prácticas (lab-front)

> Pegá este prompt a un agente trabajando en el repo `C:\Users\mateo\Desktop\lab-front`.
> Es autocontenido. No requiere contexto previo.

---

## Contexto

`lab-front` es el frontend (Next.js 16 App Router, React 19, Tailwind v4, Radix,
axios, TanStack Query, Supabase auth) de un laboratorio bioquímico. Consume el
backend NestJS (`NEXT_PUBLIC_API_URL`, prefijo `/api`, auth `Authorization: Bearer`
de Supabase ya resuelto por `lib/api/server.ts`).

El catálogo de prácticas (Nomenclador NBU) ahora tiene **1445 prácticas** en la base.
La pantalla actual `app/(app)/practicas/page.tsx` solo trae 100, sin paginación ni
filtros, y nunca muestra las inactivas. Hay que rehacerla para ver/buscar/paginar
TODO el catálogo.

## Objetivo

Reemplazar `app/(app)/practicas/page.tsx` por una pantalla que liste **todas** las
prácticas con: búsqueda, filtro por sección, filtro por estado (activas/inactivas/
todas), y paginación con total. Read-only (el catálogo se mantiene desde el back).

## Contrato del backend (YA implementado, endpoint nuevo)

```
GET /api/practices/catalog
  query params (todos opcionales):
    q        string   búsqueda por nombre O código NBU (ILIKE, máx 120 chars)
    section  string   filtro por sección exacta
    status   'all' | 'active' | 'inactive'   (default 'all')
    page     int >= 1                         (default 1)
    pageSize int 1..100                        (default 50)

  respuesta 200:
  {
    "data": Practice[],     // página actual, ordenada por nombre ASC
    "total": number,        // total de filas que matchean los filtros
    "page": number,
    "pageSize": number,
    "sections": string[]    // TODAS las secciones distintas (para el dropdown)
  }
```

`Practice` (forma real, OJO con los cambios):

```ts
interface Practice {
  id: number;
  nbuCode: string;
  name: string;
  shortName: string | null;
  category: string | null;
  section: string | null;
  units: string | null;          // ⚠️ AHORA puede ser null (práctica sin U.B.)
  notes: string | null;          // ⚠️ CAMPO NUEVO (procedencia de la migración)
  requiresAuthorization: boolean;
  referenceValueTemplate: unknown | null;
  isSpecialAct: boolean;
  active: boolean;               // false = "Prácticas en Desuso"
  createdAt: string;
  updatedAt: string;
}
```

Secciones reales que devolverá el back: `Prácticas Generales`, `Prácticas Especiales`,
`Prácticas en Desuso`, `Gestión Administrativa` (+ alguna heredada del seed).
Hay 68 inactivas y 175 sin U.B. (`units = null`).

**No toques** el endpoint viejo `GET /api/practices` (lo usa el selector de órdenes
`components/domain/nbu-grid.tsx`). Solo consumí `/practices/catalog` en esta pantalla.

## Tareas concretas

### 1. Actualizar el tipo `Practice`

En `lib/api/types.ts` (es espejo manual del backend, no hay paquete compartido):
- Cambiar `units: string` → `units: string | null`.
- Agregar `notes: string | null`.
- Agregar el tipo de la respuesta del catálogo:
  ```ts
  export interface PracticeCatalog {
    data: Practice[];
    total: number;
    page: number;
    pageSize: number;
    sections: string[];
  }
  ```
- Si `units: string` se usaba como no-nullable en otros lados (ej. `nbu-grid.tsx`,
  pricing), revisá y manejá el `null` donde haga falta SIN romper esos flujos
  (mostrar `—` o filtrar). No cambies la lógica de precios, solo el render.

### 2. Reescribir `app/(app)/practicas/page.tsx`

Server Component (`export const dynamic = 'force-dynamic'`), patrón idéntico al de
`app/(app)/pacientes/page.tsx` y `app/(app)/ordenes/page.tsx`:

- Lee `searchParams: Promise<{ q?: string; section?: string; status?: string; page?: string }>`.
- Llama:
  ```ts
  const api = await getServerApi();
  const { data } = await api.get<PracticeCatalog>('/practices/catalog', {
    params: { q, section, status, page, pageSize: 50 },
  });
  ```
  con `try/catch` que ante error devuelva un estado vacío + muestre error (mirá cómo
  `pacientes/page.tsx` hace `catch { return [] }`; acá además mostrá un mensaje).
- `<PageHeader title="Prácticas" description="Catálogo NBU — 1445 prácticas. Read-only." />`.
- Render del componente de filtros (tarea 3) pasándole `sections={resp.sections}`.
- Tabla (reusar EXACTO el estilo de la tabla de `practicas/page.tsx` actual / `pacientes`):
  columnas **NBU** (mono), **Práctica** (name + `shortName` entre paréntesis si hay),
  **Sección**, **UB** (alineado derecha, `.tabular`, mostrar `—` si `units === null`),
  **Atributos** (badges). Badges con la clase exacta del repo:
  `inline-flex items-center rounded-md border px-2 py-0.5 font-medium text-[10px] uppercase tracking-wide`
  - `requiresAuthorization` → badge "Autorización" (warning tokens)
  - `isSpecialAct` → badge "Especial" (info tokens)
  - `!active` → badge "Inactiva" (muted tokens)
  - si `notes` tiene valor, ponelo como `title=` (tooltip) en la fila o en un ícono.
- `<EmptyState icon={FlaskConical} ... />` cuando `data.length === 0` (distinguí
  "sin resultados para la búsqueda" vs "catálogo vacío").
- Debajo de la tabla, el componente de paginación (tarea 4).

### 3. Componente de filtros (Client Component)

Nuevo archivo `app/(app)/practicas/filters.tsx`, **mismo patrón** que
`app/(app)/ordenes/filters.tsx` (Client, `useRouter`/`useSearchParams`, debounce
~250-300ms en el texto, escribe los filtros en la URL con `router.replace`):

- Input de búsqueda (placeholder "Buscar por NBU o nombre…"). Podés reusar
  `components/domain/search-input.tsx` para el texto, o replicar el patrón inline
  como hace `ordenes/filters.tsx`.
- `<select>` Sección: opción "Todas las secciones" + una opción por cada
  `props.sections` (las pasa el server component). Estilo `select` EXACTO al de
  `ordenes/filters.tsx` (la const `selectCls`).
- `<select>` Estado: "Todas" (`all`), "Activas" (`active`), "Inactivas" (`inactive`).
- Botón "Limpiar" cuando hay filtros activos (igual que `ordenes/filters.tsx`).
- **Importante:** cuando cambia cualquier filtro, resetear `page` a 1 (no arrastrar
  el page viejo en la URL).

### 4. Componente de paginación (Client Component, NUEVO en el repo)

No existe paginación en el repo todavía. Creá `components/domain/pagination.tsx`
reutilizable y minimalista, coherente con el design system:

- Props: `total: number`, `page: number`, `pageSize: number`.
- Calcula `totalPages = Math.max(1, Math.ceil(total / pageSize))`.
- Muestra: "Mostrando X–Y de TOTAL" + botones "Anterior" / "Siguiente"
  (deshabilitados en extremos) + "Página P de N".
- Navega cambiando el query param `page` en la URL con `useRouter().replace`
  preservando el resto de params (`useSearchParams`).
- Usá `<Button variant="outline" size="sm">` del repo y tokens CSS. Números con
  clase `.tabular`. Sin colores hardcodeados.

### 5. Sidebar

Ya existe el item `/practicas` en `components/layout/sidebar.tsx` (`FlaskConical`).
No hay que tocarlo.

## Reglas del repo (obligatorias)

- **Next 16 / React 19**: leé `AGENTS.md` del repo — esta versión de Next tiene
  breaking changes; antes de codear consultá `node_modules/next/dist/docs/` para
  cualquier API que dudes. `searchParams` es un **Promise** (hay que `await`).
- **Server Components por defecto**; solo `'use client'` en filtros y paginación.
- **Tailwind v4 + tokens CSS**: NUNCA hardcodear colores. Usá las CSS custom
  properties (`var(--color-*)`, `var(--shadow-*)`, `var(--radius-*)`) tal cual las
  usan `pacientes/page.tsx` y `ordenes/filters.tsx`.
- Números/códigos en tablas: clase `.tabular` + `font-mono` para el código NBU.
- Errores al usuario: toasts con `sonner` (`import { toast } from 'sonner'`) si hace
  falta del lado cliente; en el server component, estado de error visible.
- Lint/format: `pnpm lint` (Biome) y `pnpm typecheck` deben pasar limpios.
- TypeScript estricto, alias `@/`.

## Criterios de aceptación (verificar antes de dar por hecho)

1. `/practicas` lista prácticas paginadas; con `pageSize 50` y ~1445 totales se ve
   "Página 1 de 29" (o el N que corresponda) y se puede navegar hasta el final.
2. La búsqueda por nombre y por código NBU filtra (server-side) y resetea a página 1.
3. El filtro de sección se puebla solo desde `resp.sections` y filtra.
4. El filtro de estado permite ver las **inactivas** (las 68 "en desuso") — hoy es
   imposible verlas; debe poder.
5. Prácticas sin U.B. muestran `—` en la columna UB (no "null", no vacío raro, no rompe).
6. Badges Autorización / Especial / Inactiva se ven con el estilo del repo.
7. Estados vacío / error / carga correctos. Sin colores hardcodeados.
8. `pnpm typecheck` y `pnpm lint` limpios. El selector de prácticas en "Nueva orden"
   (`nbu-grid.tsx`) sigue funcionando igual (no se tocó su endpoint).
9. Probar en navegador: navegación de páginas, combinación de filtros + búsqueda +
   paginación, y que la URL refleje el estado (compartible/recargable).

## Notas

- El backend `/api/practices/catalog` ya está implementado en `lab-back`. Si en
  desarrollo responde 404, es que falta desplegar/levantar el backend con el último
  build — avisar, no inventar otro endpoint.
- No implementar edición/alta/baja de prácticas: es read-only en esta etapa.
- `notes`, `category`, `shortName`, `referenceValueTemplate` pueden venir null/vacíos
  para la mayoría; el render debe tolerarlo.
