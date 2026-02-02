# syntax=docker/dockerfile:1

# Base image with Bun
FROM oven/bun:1.3-alpine AS base
WORKDIR /app

# Stage 1: Prune the monorepo for api package
FROM base AS pruner
RUN bun add -g turbo
COPY . .
RUN turbo prune api --docker

# Stage 2: Install dependencies (cached layer)
FROM base AS installer
COPY --from=pruner /app/out/json/ .
COPY --from=pruner /app/out/bun.lock ./bun.lock
RUN bun install

# Stage 3: Production runner
FROM base AS runner
ENV NODE_ENV=production

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 api

# Copy installed dependencies
COPY --from=installer /app/node_modules ./node_modules
COPY --from=pruner /app/out/bun.lock ./bun.lock
COPY --from=pruner /app/out/full/ .

USER api

WORKDIR /app/apps/api

EXPOSE 3001

CMD ["bun", "run", "src/index.ts"]
