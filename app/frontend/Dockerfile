# ── Stage 1: Dependências ──────────────────────────────────────────────────────
FROM node:22-slim AS deps
WORKDIR /app

COPY package.json package-lock.json ./
COPY app/frontend/package.json ./app/frontend/

RUN npm ci

# ── Stage 2: Build ─────────────────────────────────────────────────────────────
FROM deps AS build
WORKDIR /app

COPY app/frontend ./app/frontend
COPY tsconfig.base.json ./

ARG NEXT_PUBLIC_API_URL=http://localhost:4001
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build -w app/frontend

# ── Stage 3: Runtime standalone ────────────────────────────────────────────────
FROM node:22-slim AS runtime

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

WORKDIR /app

# Next standalone inclui apenas o que precisa
COPY --from=build /app/app/frontend/.next/standalone ./
COPY --from=build /app/app/frontend/.next/static ./app/frontend/.next/static
COPY --from=build /app/app/frontend/public ./app/frontend/public

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "app/frontend/server.js"]
