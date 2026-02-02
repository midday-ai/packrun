# syntax=docker/dockerfile:1

# Base image with Bun (matches packageManager in package.json)
FROM oven/bun:1.3-alpine AS base
WORKDIR /app

# Stage 1: Prune the monorepo for web package
FROM base AS pruner
RUN bun add -g turbo
COPY . .
RUN turbo prune web --docker

# Stage 2: Install dependencies (cached layer)
FROM base AS installer
# Copy pruned package.json files
COPY --from=pruner /app/out/json/ .
# Copy pruned lockfile (turbo prune puts it at out/ root, not in json/)
COPY --from=pruner /app/out/bun.lock ./bun.lock
RUN bun install

# Stage 3: Build the application
FROM base AS builder
# Copy installed dependencies
COPY --from=installer /app/node_modules ./node_modules
# Copy pruned lockfile for turbo workspace resolution
COPY --from=pruner /app/out/bun.lock ./bun.lock
# Copy pruned source code
COPY --from=pruner /app/out/full/ .

# Build the Next.js app
ENV NEXT_TELEMETRY_DISABLED=1
RUN bun run build --filter=web

# Stage 4: Production runner
FROM base AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy standalone build (monorepo creates nested structure)
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/public ./apps/web/public

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# server.js is at apps/web/server.js in standalone output for monorepos
CMD ["bun", "run", "apps/web/server.js"]
