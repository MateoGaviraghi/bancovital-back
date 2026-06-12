# syntax=docker/dockerfile:1.7

# ============================================================================
# base — node 22 alpine con pnpm 9.15.4
# ============================================================================
FROM node:22-alpine AS base
WORKDIR /app
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
# corepack para usar el pnpm exacto del packageManager field
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

# ============================================================================
# deps — TODAS las dependencias para el build (dev + prod).
# NOTA: el Metal builder de Railway no acepta --mount=type=cache sin un
# prefix `cacheKey:` propietario. Para mantener portabilidad lo omitimos.
# La capa se cachea de todos modos por hash de package.json + pnpm-lock.yaml.
# ============================================================================
FROM base AS deps
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# ============================================================================
# build — compila TS a dist/
# ============================================================================
FROM base AS build
COPY package.json pnpm-lock.yaml tsconfig.json tsconfig.build.json nest-cli.json ./
COPY --from=deps /app/node_modules ./node_modules
COPY src ./src
RUN pnpm build

# ============================================================================
# prod-deps — SOLO dependencias de producción.
# Stage aislado para copiar node_modules directo al runtime y NO correr
# pnpm install en la imagen final.
# ============================================================================
FROM base AS prod-deps
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod

# ============================================================================
# runtime — imagen final mínima: solo node + node_modules prod + dist.
# Sin pnpm, sin corepack, sin install: arranca directo con node.
# ============================================================================
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=4000

COPY package.json ./
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist

EXPOSE 4000
CMD ["node", "dist/main.js"]
