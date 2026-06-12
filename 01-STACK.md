# 01 — Stack tecnológico

## Decisiones principales

| Capa | Tecnología | Por qué |
|---|---|---|
| Runtime | **Node.js 22 LTS** | Estable, soporte largo |
| Framework | **NestJS 10** | Modular, opinado, DI, fácil para devs nuevos |
| API style | **REST** | Estándar de NestJS. Sin tRPC. |
| Validación | **class-validator + class-transformer** | DTOs con decoradores. Integración nativa con NestJS |
| ORM | **Drizzle ORM** | Type-safe, migrations declarativas, ya tenemos los schemas |
| DB | **Postgres 16** (Supabase managed) | RLS, triggers, gen_random_uuid |
| Auth | **Supabase Auth** (JWT) | Maneja signup, magic link, sesiones |
| Storage | **Supabase Storage** | Bucket `reports` para PDFs firmados |
| PDFs | **@react-pdf/renderer** | Generación server-side, templates JSX |
| Money | **decimal.js** | Precisión decimal, HALF_UP rounding |
| Logger | **NestJS Logger** + opcional Pino | Estructurado |
| Tests | **Jest** (built-in NestJS) | Unitarios + e2e |
| Format/Lint | **Biome** | Reemplaza ESLint + Prettier |
| Container | **Docker** (multi-stage) | Para Railway |
| Hosting | **Railway** | Sin cold starts |

## Dependencias exactas (package.json)

### dependencies

```json
{
  "@nestjs/common": "^10.4.0",
  "@nestjs/core": "^10.4.0",
  "@nestjs/platform-express": "^10.4.0",
  "@nestjs/config": "^3.2.0",
  "@nestjs/swagger": "^7.4.0",
  "@supabase/supabase-js": "2.47.10",
  "@react-pdf/renderer": "4.1.6",
  "class-validator": "^0.14.1",
  "class-transformer": "^0.5.1",
  "drizzle-orm": "0.45.2",
  "postgres": "3.4.5",
  "decimal.js": "10.4.3",
  "react": "19.0.0",
  "reflect-metadata": "^0.2.2",
  "rxjs": "^7.8.0",
  "helmet": "^8.0.0",
  "compression": "^1.7.4"
}
```

### devDependencies

```json
{
  "@nestjs/cli": "^10.4.0",
  "@nestjs/schematics": "^10.2.0",
  "@nestjs/testing": "^10.4.0",
  "@types/express": "^5.0.0",
  "@types/jest": "^29.5.0",
  "@types/node": "22.10.5",
  "@types/react": "19.0.2",
  "@biomejs/biome": "1.9.4",
  "drizzle-kit": "0.31.10",
  "jest": "^29.7.0",
  "rimraf": "6.0.1",
  "supertest": "^7.0.0",
  "ts-jest": "^29.2.0",
  "ts-node": "^10.9.0",
  "tsconfig-paths": "^4.2.0",
  "typescript": "5.7.2"
}
```

## Cómo se compara con la versión anterior

| Antes (Hono + tRPC) | Ahora (NestJS + REST) |
|---|---|
| Hono app declarativo | `@Controller`, `@Module`, `@Injectable` |
| tRPC procedures | REST endpoints (`@Get`, `@Post`, etc.) |
| Zod en procedure input | DTOs con `class-validator` |
| Middleware en cadena | Guards + Interceptors + Pipes |
| Type-safety end-to-end | OpenAPI/Swagger auto-generado |
| Cold start fast | Más startup time pero mejor estructura |

Lo que **NO cambia**:
- Drizzle schemas (reusables tal cual)
- Lógica de negocio (pricing, money, status FSM)
- Validación de rangos de referencia
- Generación de PDFs
- Modelo de auth (Supabase JWT)
- Esquema de base de datos
- Roles y permisos

## Documentación externa

- NestJS docs: https://docs.nestjs.com
- Drizzle ORM: https://orm.drizzle.team
- class-validator: https://github.com/typestack/class-validator
- Supabase: https://supabase.com/docs
