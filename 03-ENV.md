# 03 — Variables de entorno

## Archivo `.env` en raíz

```env
# Server
NODE_ENV=development
PORT=4000

# Database (Supabase pooler — Transaction mode, port 6543)
DATABASE_URL=postgresql://postgres.<project-ref>:<password>@aws-1-sa-east-1.pooler.supabase.com:6543/postgres

# Supabase (back-side credentials)
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...    # NUNCA exponer al cliente
SUPABASE_JWT_SECRET=                 # opcional, validamos remoto

# CORS: dominios permitidos a llamar la API
CORS_ALLOWED_ORIGINS=http://localhost:3000,https://lab-front.vercel.app

# Opcionales
RESEND_API_KEY=
SENTRY_DSN=
AXIOM_TOKEN=
AXIOM_DATASET=
```

## `.env.example` (commitear este, no el `.env`)

Misma estructura, sin valores reales. Va en el repo.

## Loader con `@nestjs/config`

`src/config.ts`:

```typescript
import { ConfigService } from '@nestjs/config';
import { Injectable } from '@nestjs/common';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().url(),
  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  SUPABASE_JWT_SECRET: z.string().optional(),
  CORS_ALLOWED_ORIGINS: z.string().default('http://localhost:3000'),
  RESEND_API_KEY: z.string().optional(),
  SENTRY_DSN: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

@Injectable()
export class AppConfig {
  constructor(private readonly config: ConfigService) {}

  get env(): Env {
    return envSchema.parse({
      NODE_ENV: this.config.get('NODE_ENV'),
      PORT: this.config.get('PORT'),
      DATABASE_URL: this.config.get('DATABASE_URL'),
      SUPABASE_URL: this.config.get('SUPABASE_URL'),
      SUPABASE_ANON_KEY: this.config.get('SUPABASE_ANON_KEY'),
      SUPABASE_SERVICE_ROLE_KEY: this.config.get('SUPABASE_SERVICE_ROLE_KEY'),
      SUPABASE_JWT_SECRET: this.config.get('SUPABASE_JWT_SECRET'),
      CORS_ALLOWED_ORIGINS: this.config.get('CORS_ALLOWED_ORIGINS'),
      RESEND_API_KEY: this.config.get('RESEND_API_KEY'),
      SENTRY_DSN: this.config.get('SENTRY_DSN'),
    });
  }

  get corsOrigins(): string[] {
    return this.env.CORS_ALLOWED_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean);
  }
}
```

## Documentación de cada variable

| Variable | Tipo | Required | Descripción |
|---|---|---|---|
| `NODE_ENV` | enum | No (default `development`) | Modo de ejecución |
| `PORT` | int | No (default `4000`) | Puerto del servidor HTTP |
| `DATABASE_URL` | URL postgres | **Sí** | Conexión a la DB. Usar pooler de Supabase en producción |
| `SUPABASE_URL` | URL | **Sí** | URL del proyecto Supabase |
| `SUPABASE_ANON_KEY` | string | **Sí** | Clave pública (para validar JWT) |
| `SUPABASE_SERVICE_ROLE_KEY` | string | **Sí** | Clave admin (bypass RLS, listar usuarios). **Nunca exponer al cliente** |
| `SUPABASE_JWT_SECRET` | string | No | Si querés validar localmente; sino se valida con Supabase remoto |
| `CORS_ALLOWED_ORIGINS` | csv | No (default localhost) | Lista coma-separada de dominios permitidos |
| `RESEND_API_KEY` | string | No | Para enviar mails (Phase 2+) |
| `SENTRY_DSN` | string | No | Observabilidad |

## Dónde van en cada entorno

| Variable | Local | Railway | CI |
|---|---|---|---|
| Todas | `.env` local | Variables del servicio | GitHub Secrets |

**Importante:** `.env` NUNCA va en git. Pasalo por canal privado (chat directo, password manager).
