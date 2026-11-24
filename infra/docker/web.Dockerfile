# syntax=docker/dockerfile:1

# Stage 1: Base setup with pnpm
FROM node:22-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@latest --activate
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Stage 2: Install dependencies
FROM base AS deps
WORKDIR /app

# Copy dependency specifications
COPY apps/web/package.json apps/web/pnpm-lock.yaml ./apps/web/
COPY packages/viewer/package.json packages/viewer/pnpm-lock.yaml* ./packages/viewer/

# Install web dependencies
WORKDIR /app/apps/web
RUN pnpm install --frozen-lockfile

# Stage 3: Build application
FROM base AS builder
WORKDIR /app

# Copy dependencies and sources
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules
COPY packages/viewer ./packages/viewer
COPY apps/web ./apps/web

WORKDIR /app/apps/web
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# Run Next.js build
RUN pnpm run build

# Stage 4: Production runner
FROM node:22-alpine AS runner
WORKDIR /app

RUN apk add --no-cache wget curl libc6-compat

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Create unprivileged system user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy built application and required assets
COPY --from=builder /app/packages/viewer ./packages/viewer
COPY --from=builder /app/apps/web/package.json ./apps/web/package.json
COPY --from=builder /app/apps/web/node_modules ./apps/web/node_modules
COPY --from=builder /app/apps/web/.next ./apps/web/.next
COPY --from=builder /app/apps/web/public* ./apps/web/public/

USER nextjs

WORKDIR /app/apps/web

EXPOSE 3000

CMD ["./node_modules/.bin/next", "start", "--port", "3000", "--hostname", "0.0.0.0"]
