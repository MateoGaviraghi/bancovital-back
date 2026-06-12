# 10 — Deploy a Railway

Hosting: **Railway**. Build: **Dockerfile multi-stage**.

## Dockerfile (raíz del repo)

```dockerfile
# syntax=docker/dockerfile:1.7

# -------- base --------
FROM node:22-alpine AS base
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

# -------- deps --------
FROM base AS deps
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# -------- build --------
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build

# -------- runtime --------
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./
EXPOSE 4000
CMD ["node", "dist/main.js"]
```

## railway.json (raíz del repo)

```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "DOCKERFILE",
    "dockerfilePath": "Dockerfile"
  },
  "deploy": {
    "startCommand": "node dist/main.js",
    "healthcheckPath": "/api/healthz",
    "healthcheckTimeout": 30,
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 3
  }
}
```

## Configuración en Railway dashboard

1. **New Project** → Deploy from GitHub repo → seleccionar `lab-back`
2. Va a detectar el `Dockerfile` automáticamente. Si no, ir a Settings → Build:
   - Builder: `Dockerfile`
   - Dockerfile Path: `Dockerfile`
3. **Healthcheck Path:** `/api/healthz`
4. **Variables** (tab Variables):
   - `NODE_ENV=production`
   - `DATABASE_URL=postgresql://...` (el pooler de Supabase)
   - `SUPABASE_URL=https://....supabase.co`
   - `SUPABASE_ANON_KEY=...`
   - `SUPABASE_SERVICE_ROLE_KEY=...`
   - `CORS_ALLOWED_ORIGINS=https://lab-front.vercel.app,http://localhost:3000`
   - (los demás opcionales)
5. **Networking**: Generate Domain → Railway te da una URL pública tipo `lab-back-production-xxxx.up.railway.app`.

## Flujo de deploys

- Cada push a `main` → Railway detecta → build → deploy automático.
- ~2-3 min total.
- Healthcheck verifica `/api/healthz` antes de poner el deploy en producción.
- Si falla, rollback automático.

## Logs

Railway dashboard → tu servicio → tab **Logs**. Tres tipos:
- **Build Logs**: salida del Docker build
- **Deploy Logs**: stdout/stderr del container running
- **HTTP Logs**: requests entrantes

Para producción real, opcionalmente enviar a Axiom o Sentry (env vars opcionales).

## Costo

- Free tier: ~500 horas / mes (suficiente para un cliente).
- Pago: $5/mes mínimo después del free tier.

## Verificación post-deploy

```bash
curl https://lab-back-production-xxxx.up.railway.app/api/healthz
# → {"ok":true,"time":"..."}

curl https://lab-back-production-xxxx.up.railway.app/api/patients
# → 401 Unauthorized (sin token, esperado)
```

## Rollback rápido

Railway dashboard → tab **Deployments** → click en un deploy anterior → **Redeploy**.

O via git:

```bash
git revert <bad-commit-hash>
git push origin main
# Railway redeploya con el revert
```
