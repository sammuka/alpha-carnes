# ── Stage 1: Dependências ──────────────────────────────────────────────────────
FROM node:22-slim AS deps
WORKDIR /app

# Copiar lockfile e package.json raiz + workspace backend
COPY package.json package-lock.json ./
COPY app/backend/package.json ./app/backend/

# Instalar todas as deps (inclui devDeps para build)
RUN npm ci

# ── Stage 2: Build ─────────────────────────────────────────────────────────────
FROM deps AS build
WORKDIR /app

COPY app/backend ./app/backend
COPY tsconfig.base.json ./

RUN npm run build -w app/backend

# ── Stage 3: Runtime ───────────────────────────────────────────────────────────
FROM node:22-slim AS runtime
WORKDIR /app

# Instalar apenas deps de produção
COPY package.json package-lock.json ./
COPY app/backend/package.json ./app/backend/
RUN npm ci --omit=dev

# Copiar build
COPY --from=build /app/app/backend/dist ./app/backend/dist

# Copiar migrations (necessário em runtime para drizzle migrator)
COPY app/backend/src/database/migrations ./app/backend/dist/database/migrations

# Entrypoint
COPY app/backend/docker-entrypoint.sh ./docker-entrypoint.sh
RUN sed -i 's/\r$//' ./docker-entrypoint.sh && chmod +x ./docker-entrypoint.sh

EXPOSE 3001
ENTRYPOINT ["./docker-entrypoint.sh"]
