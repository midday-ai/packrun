# Infrastructure Setup

This document describes how to deploy packrun.dev to Railway with multi-region support.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Cloudflare CDN                                     │
│                (Global edge caching, DDoS protection)                        │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Users                                           │
├────────────────┬────────────────────────┬───────────────────────────────────┤
│    EU Users    │     US East Users      │       US West / APAC Users        │
└───────┬────────┴───────────┬────────────┴──────────────────┬────────────────┘
        │                    │                               │
        ▼                    ▼                               ▼
┌───────────────┐    ┌───────────────┐              ┌───────────────┐
│    Railway    │    │    Railway    │              │    Railway    │
│   Amsterdam   │    │   Virginia    │              │  California   │
│    (web)      │    │  (web+api+    │              │    (web)      │
│               │    │   worker)     │              │               │
└───────┬───────┘    └───────┬───────┘              └───────┬───────┘
        │                    │                               │
        └────────────────────┼───────────────────────────────┘
                             │
                             ▼
              ┌──────────────────────────────┐
              │        API Server            │
              │   (MCP + REST endpoints)     │
              │                              │
              │  ┌────────┐   ┌──────────┐   │
              │  │ Redis  │   │Typesense │   │
              │  │ Cache  │   │  Index   │   │
              │  └────────┘   └──────────┘   │
              └──────────────────────────────┘
```

## Data Flow

### Search Flow
```
User Search → Web App → API /api/search → Typesense → Results
                                │
                                └──→ (fallback) npm registry → Queue for sync
```

### Package Page Flow
```
User Request → Web App (ISR) → API /api/package/:name/health
                                        │
                                        ▼
                               ┌────────────────┐
                               │  Redis Cache   │ ← 1 hour TTL
                               │   (health)     │
                               └───────┬────────┘
                                       │ miss
                                       ▼
                               ┌────────────────┐
                               │   Typesense    │ ← Core package data
                               │    (index)     │
                               └───────┬────────┘
                                       │ miss
                                       ▼
                               ┌────────────────┐
                               │  npm Registry  │ ← Fetch + queue for sync
                               └───────┬────────┘
                                       │
                                       ▼
                               ┌────────────────┐
                               │  Enrichment    │
                               │  (GitHub,      │
                               │   npms.io,     │
                               │   OSV)         │
                               └────────────────┘
```

### Sync Worker Architecture
```
┌──────────────────┐     ┌──────────────┐     ┌──────────────┐
│ npm Changes Feed │────▶│   Listener   │────▶│    Redis     │
│ (CouchDB stream) │     │  (producer)  │     │   (BullMQ)   │
└──────────────────┘     └──────────────┘     └──────┬───────┘
                                                     │
                              ┌───────────────────────┘
                              │
                              ▼
┌──────────────────┐     ┌──────────────┐     ┌──────────────┐
│   API Server     │────▶│   Processor  │────▶│  Typesense   │
│ (queues on miss) │     │   (worker)   │     │   (index)    │
└──────────────────┘     └──────────────┘     └──────────────┘
```

## Packages & Apps

### Monorepo Structure

```
packrun.dev/
├── apps/
│   ├── web/          # Next.js web app (package pages, search UI)
│   ├── api/          # Hono API server (MCP + REST)
│   └── worker/       # BullMQ sync worker (listener + processor)
│
└── packages/
    ├── clients/      # Shared API clients (npm, GitHub, OSV, npms.io)
    ├── decisions/    # Package comparison & health scoring logic
    ├── readme-renderer/  # README HTML rendering
    └── typescript-config/ # Shared TypeScript configs
```

### Shared Data Clients (`@packrun/data`)

Centralized API clients used by both worker and API:

| Client | Purpose |
|--------|---------|
| `@packrun/data/npm` | npm registry metadata & downloads |
| `@packrun/data/github` | GitHub repo data (stars, issues, commits) |
| `@packrun/data/osv` | Vulnerability data from OSV |
| `@packrun/data/npms` | Quality scores from npms.io |
| `@packrun/data/bundlephobia` | Bundle size metrics |

## Caching Strategy

| Layer | What | TTL | Location |
|-------|------|-----|----------|
| Cloudflare | HTML pages, static assets | 1 hour (stale-while-revalidate: 1 day) | Edge (300+ locations) |
| Next.js ISR | Package pages | 1 hour | Railway (3 regions) |
| In-memory LRU | Health data, scores, GitHub data | 1 hour - 7 days | API instances (3 regions) |
| Typesense | Search index | Real-time sync | Cloud SDN (3 regions) |

### In-Memory Cache Keys (API)

| Key Pattern | Data | TTL |
|-------------|------|-----|
| `pkg:{name}:health` | Full health response | 1 hour |
| `pkg:{name}:scores` | npms.io scores | 7 days |
| `pkg:{name}:github` | GitHub repo data | 1 day |
| `pkg:{name}:details` | Enriched package details | 1 day |
| `pkg:{name}:security` | Security signals | 1 day |
| `pkg:{name}:trend` | Download trend analysis | 1 day |
| `queued:{name}` | Queue deduplication flag | 5 minutes |

**Note:** Cache is per-instance (not shared across regions) and cleared on restart.

## Prerequisites

1. **Railway Pro Plan** - Required for multi-region replicas
2. **Typesense Cloud Account** - With SDN (Search Delivery Network) enabled
3. **Cloudflare Account** - Free tier is sufficient
4. **GitHub Repository** - Connected to Railway

## Step 1: Typesense Cloud SDN Setup

1. Go to [Typesense Cloud Dashboard](https://cloud.typesense.org/)
2. Select your cluster or create a new one
3. Enable **Search Delivery Network (SDN)**
4. Select 3 regions:
   - **Frankfurt** (EU)
   - **N. Virginia** (US East)
   - **Oregon** (US West)
5. Note down your API keys:
   - Admin API Key (for server-side operations)
   - Search-only API Key (for client-side, safe to expose)
6. Note the **Nearest Node** hostname (e.g., `xxx.a1.typesense.net`)

## Step 2: Railway Project Setup

### Project Structure

```
packrun (Project)
├── web (Service) - 3 replicas (Amsterdam, Virginia, California)
├── api (Service) - 3 replicas (Amsterdam, Virginia, California) [in-memory cache]
├── listener (Service) - npm changes listener (producer)
├── processor (Service) - job processor (worker)
└── redis-queue (Database) - BullMQ queue (central, US East)
```

### Multi-Region Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                       Web (3 regions)                           │
│            Amsterdam      Virginia      California              │
└───────────────┬──────────────┬──────────────┬───────────────────┘
                │              │              │
                ▼              ▼              ▼
┌───────────────────┐ ┌───────────────┐ ┌───────────────────┐
│   API (Amsterdam) │ │ API (Virginia)│ │ API (California)  │
│  [in-memory LRU]  │ │[in-memory LRU]│ │  [in-memory LRU]  │
└─────────┬─────────┘ └───────┬───────┘ └─────────┬─────────┘
          │                   │                   │
          └───────────────────┼───────────────────┘
                              │ (queue only, async)
                              ▼
              ┌───────────────────────────────────┐
              │      Virginia (US East)           │
              │  ┌─────────────┐   ┌──────────┐   │
              │  │ Queue Redis │◀──│  Worker  │   │
              │  │(redis-queue)│   │          │   │
              │  └─────────────┘   └──────────┘   │
              └───────────────────────────────────┘
```

**Key points:**
- **In-memory LRU cache** - Each API instance has fast local cache (~0ms)
- **Queue Redis** (1x) - Central BullMQ queue in US East
- Queue operations are async/non-blocking, so cross-region latency doesn't affect response time
- Cache is cleared on restart (acceptable - data refetched from Typesense/npm)

### Automatic Import (Recommended)

Railway auto-detects JavaScript monorepos. When you import the repo:

1. Go to [Railway Dashboard](https://railway.com/new)
2. Select **Deploy from GitHub repo**
3. Choose the `packrun.dev` repository
4. Railway will auto-detect services from `railway.json` files
5. Click **Deploy** to create all services

### Manual Setup (Alternative)

If auto-import doesn't work:

1. Create an empty project
2. Add **four** services from the same repo:
   - Web: `/apps/web/railway.json`
   - API: `/apps/api/railway.json`
   - Listener: `/apps/worker/railway.listener.json`
   - Processor: `/apps/worker/railway.processor.json`
3. Add **one** Redis database:
   - `redis-queue` (Virginia region) - BullMQ queue
4. Configure environment variables (see below)

## Step 3: Environment Variables

### Web Service

| Variable | Description |
|----------|-------------|
| `TYPESENSE_API_KEY` | Admin API key from Typesense Cloud |
| `TYPESENSE_HOST` | Typesense Cloud nearest node host |
| `NEXT_PUBLIC_TYPESENSE_SEARCH_API_KEY` | Search-only API key (public) |
| `NEXT_PUBLIC_API_URL` | API server URL (e.g., `https://api.packrun.dev`) |
| `REVALIDATE_TOKEN` | Secret token for on-demand ISR cache revalidation |

### API Service

| Variable | Description |
|----------|-------------|
| `PORT` | Port to listen on (default: 3001) |
| `REDIS_URL` | Queue Redis URL (`${{redis-queue.REDIS_URL}}`) |
| `TYPESENSE_API_KEY` | Admin API key from Typesense Cloud |
| `TYPESENSE_HOST` | Typesense Cloud nearest node host |

**Note:** API uses in-memory LRU cache. Redis is only used for the BullMQ queue.

### Worker Services (Listener & Processor)

| Variable | Description |
|----------|-------------|
| `TYPESENSE_API_KEY` | Admin API key from Typesense Cloud |
| `TYPESENSE_HOST` | Typesense Cloud nearest node host |
| `REDIS_URL` | Queue Redis URL (`${{redis-queue.REDIS_URL}}`) |
| `WEB_URL` | (Optional) Web app URL for auto-revalidation |
| `REVALIDATE_TOKEN` | (Optional) Token for triggering ISR revalidation |

## Step 4: Cloudflare Setup

### Add Domain to Cloudflare

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Add your domain (e.g., `packrun.dev`)
3. Update nameservers at your registrar

### Configure DNS

| Record | Name | Target | Proxy |
|--------|------|--------|-------|
| CNAME | `@` | `your-web-app.up.railway.app` | Proxied |
| CNAME | `api` | `your-api-app.up.railway.app` | Proxied |
| CNAME | `mcp` | `your-api-app.up.railway.app` | **DNS Only** (gray cloud) |

**Note**: The `mcp` subdomain must be DNS-only (not proxied) to bypass Cloudflare's 100-second SSE timeout. See `apps/api/CLOUDFLARE_MCP_FIX.md` for details.

### Cloudflare Settings

| Setting | Value |
|---------|-------|
| SSL/TLS | Full (strict) |
| Always Use HTTPS | On |
| Auto Minify | JS, CSS, HTML |
| Brotli | On |
| Browser Cache TTL | Respect Existing Headers |

## Step 5: Custom Domains (Railway)

1. In Railway, go to Web service → **Settings** → **Networking**
2. Click **Add Custom Domain**
3. Enter your domain (e.g., `packrun.dev`)
4. For API service, add two custom domains:
   - `api.packrun.dev` (for REST API endpoints with Cloudflare caching)
   - `mcp.packrun.dev` (for MCP endpoint, bypasses Cloudflare to avoid SSE timeout)

## Verification

### Check Web Health

```bash
curl https://packrun.dev/api/health
```

Expected:
```json
{
  "status": "healthy",
  "timestamp": "2026-02-02T12:00:00.000Z",
  "region": "europe-west4"
}
```

### Check API Health

```bash
curl https://api.packrun.dev/health
```

Expected:
```json
{
  "status": "healthy",
  "timestamp": "2026-02-02T12:00:00.000Z"
}
```

### Check Package Health Endpoint

```bash
curl https://api.packrun.dev/api/package/react/health | jq '.health'
```

Expected:
```json
{
  "score": 95,
  "grade": "A",
  "status": "active",
  "signals": {
    "positive": ["Active development", "High downloads"],
    "negative": [],
    "warnings": []
  }
}
```

### Check Cache Headers

```bash
curl -I https://packrun.dev/react
```

Look for:
```
cache-control: public, s-maxage=3600, stale-while-revalidate=86400
cf-cache-status: HIT
```

## Monitoring

### Cloudflare Analytics

- Request count and bandwidth
- Cache hit ratio (target: >80%)
- Threats blocked
- Performance metrics by region

### Railway Metrics

- CPU and Memory usage per service
- Request count and latency
- Logs from all regions

### Typesense Cloud Metrics

- Search requests per region
- Latency by region
- Index size and document count

### Redis Monitoring

- Queue stats (waiting, active, failed jobs)
- Cache hit/miss ratio
- Memory usage

## Costs

### Railway (Pro Plan)

- $20/month base
- Usage-based pricing for compute
- ~$15-30/month for 4 services + Redis

### Typesense Cloud (SDN)

- Pricing varies by cluster size
- SDN adds ~30% premium for 3-region setup
- Check [Typesense Pricing](https://cloud.typesense.org/pricing)

### Cloudflare

- Free tier is sufficient for most use cases
- Pro ($20/month) for advanced features

## Troubleshooting

### Healthcheck Failing

1. Check if the app builds successfully
2. Verify environment variables are set
3. Check deployment logs for errors

### API Not Responding

1. Verify `REDIS_URL` is set and Redis is running
2. Check `TYPESENSE_API_KEY` and `TYPESENSE_HOST`
3. Check API logs for connection errors

### Worker Not Processing

1. Verify Redis connection is working
2. Check processor logs for errors
3. Verify Typesense credentials
4. Check queue stats: `[Stats] Sync: X waiting, Y active, Z failed`

### Queue Issues

| Issue | Solution |
|-------|----------|
| Jobs stuck in waiting | Check if processor is running |
| Many failed jobs | Check processor logs for error details |
| Redis connection errors | Verify Redis URL and service status |
| Deduplication not working | Check `queued:{name}` keys in Redis |

### High Latency

1. Check Cloudflare cache hit ratio (should be >80%)
2. Verify requests route to nearest region
3. Check Redis cache hit ratio
4. Ensure Typesense uses `nearestNode` option

### Cloudflare Not Caching

1. Check `Cache-Control` headers in response
2. Verify Cloudflare proxy is enabled (orange cloud)
3. Check for `Set-Cookie` headers (prevents caching)
4. Use `cf-cache-status` header to debug
