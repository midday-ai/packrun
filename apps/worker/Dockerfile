# syntax=docker/dockerfile:1

# Base image with Bun (matches packageManager in package.json)
FROM oven/bun:1.3-alpine AS base
WORKDIR /app

# Stage 1: Prune the monorepo for worker package
FROM base AS pruner
RUN bun add -g turbo
COPY . .
RUN turbo prune worker --docker

# Stage 2: Install dependencies (cached layer)
FROM base AS installer
# Copy pruned package.json files
COPY --from=pruner /app/out/json/ .
# Copy pruned lockfile (turbo prune puts it at out/ root, not in json/)
COPY --from=pruner /app/out/bun.lock ./bun.lock
RUN bun install

# Stage 3: Production runner
FROM base AS runner
ENV NODE_ENV=production

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 worker

# Copy installed dependencies
COPY --from=installer /app/node_modules ./node_modules
# Copy pruned lockfile
COPY --from=pruner /app/out/bun.lock ./bun.lock
# Copy pruned source code
COPY --from=pruner /app/out/full/ .

USER worker

WORKDIR /app/apps/worker

CMD ["bun", "run", "src/index.ts"]
