# Infrastructure Setup

This document describes how to deploy v1.run to Railway with multi-region support.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Cloudflare CDN                                │
│              (Global edge caching, DDoS protection)                  │
└─────────────────────────────────────────────────────────────────────┘
                                  │
┌─────────────────────────────────────────────────────────────────────┐
│                           Users                                      │
├──────────────┬──────────────────────┬───────────────────────────────┤
│   EU Users   │    US East Users     │      US West / APAC Users     │
└──────┬───────┴──────────┬───────────┴───────────────┬───────────────┘
       │                  │                           │
       ▼                  ▼                           ▼
┌──────────────┐  ┌──────────────┐           ┌──────────────┐
│   Railway    │  │   Railway    │           │   Railway    │
│  Amsterdam   │  │  Virginia    │           │  California  │
│  (web)       │  │ (web+worker) │           │  (web)       │
└──────┬───────┘  └──────┬───────┘           └──────┬───────┘
       │                  │                           │
       ▼                  ▼                           ▼
┌──────────────┐  ┌──────────────┐           ┌──────────────┐
│  Typesense   │  │  Typesense   │           │  Typesense   │
│  Frankfurt   │  │  Virginia    │           │  Oregon      │
└──────────────┴──┴──────────────┴───────────┴──────────────┘
                  Typesense Cloud SDN (auto-replication)
```

### Sync Worker Architecture

```
┌──────────────────┐     ┌──────────────┐     ┌──────────────┐
│ npm Changes Feed │────▶│   Producer   │────▶│    Redis     │
│ (CouchDB stream) │     │  (index.ts)  │     │   (BullMQ)   │
└──────────────────┘     └──────────────┘     └──────┬───────┘
                                                     │
                                              ┌──────▼───────┐
                                              │    Worker    │
                                              │ (worker.ts)  │
                                              └──────┬───────┘
                                                     │
                                              ┌──────▼───────┐
                                              │  Typesense   │
                                              └──────────────┘
```

The sync worker uses BullMQ for reliable job processing:
- **Producer**: Listens to npm changes and adds jobs to Redis queue
- **Worker**: Processes jobs with retries, rate limiting, and concurrency control

## Caching Strategy

| Layer | What | TTL | Location |
|-------|------|-----|----------|
| Cloudflare | HTML pages, static assets | 1 hour (stale-while-revalidate: 1 day) | Edge (300+ locations) |
| Next.js ISR | Package pages | 1 hour | Railway (3 regions) |
| Typesense Cloud | Search index | Real-time sync | SDN (3 regions) |

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

### Create Project

1. Go to [Railway Dashboard](https://railway.com/dashboard)
2. Click **New Project**
3. Select **Deploy from GitHub repo**
4. Connect your `v1.run` repository

### Automatic Import (Recommended)

Railway auto-detects JavaScript monorepos. When you import the repo:

1. Go to [Railway Dashboard](https://railway.com/new)
2. Select **Deploy from GitHub repo**
3. Choose the `v1.run` repository
4. Railway will auto-detect both `apps/web` and `apps/worker` as deployable packages
5. Click **Deploy** to create both services

Railway will automatically:
- Find `railway.json` in each app directory
- Configure Dockerfile builds
- Set up multi-region replicas (web) and single-region (worker)
- Configure healthchecks and restart policies

### Manual Setup (Alternative)

If auto-import doesn't work:

1. Create an empty project
2. Add **three** services from the same repo (web, listener, processor)
3. For each service, set the **Railway Config File** path:
   - Web: `/apps/web/railway.json`
   - Listener: `/apps/worker/railway.listener.json`
   - Processor: `/apps/worker/railway.processor.json`
4. Add a Redis database: **+ New** → **Database** → **Redis**
5. Link Redis to worker services using variable reference: `${{redis.REDIS_URL}}`

### Config as Code

Services are configured via `railway.json` files:

**Web Service** (`apps/web/railway.json`):
- Multi-region replicas: Amsterdam, Virginia, California
- Healthcheck at `/api/health`
- Watch patterns to only rebuild on relevant changes

**Listener** (`apps/worker/railway.listener.json`):
- Runs `src/index.ts` - listens to npm changes, adds jobs to queue
- Always restart policy

**Processor** (`apps/worker/railway.processor.json`):
- Runs `src/worker.ts` - processes jobs from queue
- Always restart policy

### Railway Project Structure

```
v1-run (Project)
├── web (Service) - 3 replicas (Amsterdam, Virginia, California)
├── listener (Service) - listens to npm changes, adds to queue
├── processor (Service) - processes jobs from queue
└── redis (Database)
```

**Note**: The worker services and Redis are deployed to a single region (US East) since they need to communicate with each other and don't require multi-region.

## Step 3: Environment Variables

### Web Service Variables

| Variable | Description |
|----------|-------------|
| `TYPESENSE_API_KEY` | Admin API key from Typesense Cloud |
| `TYPESENSE_HOST` | Typesense Cloud nearest node host |
| `NEXT_PUBLIC_TYPESENSE_SEARCH_API_KEY` | Search-only API key (public) |
| `REVALIDATE_TOKEN` | Secret token for on-demand ISR cache revalidation |

### Worker Service Variables (Producer & Processor)

| Variable | Description |
|----------|-------------|
| `TYPESENSE_API_KEY` | Admin API key from Typesense Cloud |
| `TYPESENSE_HOST` | Typesense Cloud nearest node host |
| `REDIS_URL` | Redis connection URL (e.g., `redis://default:password@redis.railway.internal:6379`) |
| `WEB_URL` | (Optional) Web app URL for auto-revalidation (e.g., `https://v1.run`) |
| `REVALIDATE_TOKEN` | (Optional) Token for triggering ISR revalidation (must match web app) |

**Note**: On Railway, use the `${{redis.REDIS_URL}}` reference variable to automatically inject the Redis URL.

## Step 4: Cloudflare Setup

### Add Domain to Cloudflare

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Add your domain (e.g., `v1.run`)
3. Update nameservers at your registrar

### Configure DNS

1. Add a CNAME record pointing to your Railway domain:
   - Name: `@` (or `www`)
   - Target: `your-app.up.railway.app`
   - Proxy status: **Proxied** (orange cloud)

### Cloudflare Settings

| Setting | Value |
|---------|-------|
| SSL/TLS | Full (strict) |
| Always Use HTTPS | On |
| Auto Minify | JS, CSS, HTML |
| Brotli | On |
| Browser Cache TTL | Respect Existing Headers |

### Cache Rules (Optional)

Create a Page Rule for extra caching control:
- URL: `*v1.run/*`
- Cache Level: Standard
- Edge Cache TTL: 1 hour

## Step 5: Custom Domain (Railway)

1. In Railway, go to Web service → **Settings** → **Networking**
2. Click **Add Custom Domain**
3. Enter your domain (e.g., `v1.run`)
4. Railway will show a verification record - this is handled by Cloudflare proxy

## Verification

### Check Health Endpoint

```bash
curl https://your-domain.com/api/health
```

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "2026-02-02T12:00:00.000Z",
  "region": "europe-west4-drams3a"
}
```

### Check Cache Headers

```bash
curl -I https://v1.run/react
```

Look for:
```
cache-control: public, s-maxage=3600, stale-while-revalidate=86400
cf-cache-status: HIT
```

### Manually Revalidate a Page

If a page is showing stale data, you can manually trigger ISR revalidation:

```bash
curl -X POST "https://v1.run/api/revalidate?token=YOUR_REVALIDATE_TOKEN&path=/react"
```

Response:
```json
{"revalidated": true, "path": "/react"}
```

### Check Worker Producer Logs

In Railway dashboard, go to listener → **Deployments** → **View Logs**

You should see:
```
npm Sync Producer starting...
Typesense: xxx.a1.typesense.net:443
Redis: redis.railway.internal:6379
Starting npm changes listener (producer mode)...
Listening for changes from: now
[Producer] Queued 100 jobs (3.2/s) | Queue: 45 waiting, 5 active, 0 failed
```

### Check Worker Processor Logs

In Railway dashboard, go to processor → **Deployments** → **View Logs**

You should see:
```
npm Sync Worker starting...
Typesense: xxx.a1.typesense.net:443
Redis: redis.railway.internal:6379
Workers ready, processing jobs...
[Stats] Sync: 45 waiting, 5 active, 0 failed | Bulk: 0 waiting, 0 active
[job-123] Synced: react v18.2.0 (25,000,000 downloads/wk)
```

## Monitoring

### Cloudflare Analytics

- Request count and bandwidth
- Cache hit ratio
- Threats blocked
- Performance metrics by region

### Railway Metrics

- CPU and Memory usage per replica
- Request count and latency
- Logs from all regions

### Typesense Cloud Metrics

- Search requests per region
- Latency by region
- Index size and document count

## Costs

### Railway (Pro Plan)

- $20/month base
- Usage-based pricing for compute
- Multi-region replicas: 3x web instances

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

### Worker Not Processing

1. Verify `TYPESENSE_API_KEY` is set correctly
2. Verify `REDIS_URL` is set and Redis is running
3. Check if npm registry is accessible
4. Look for rate limiting errors in logs
5. Check queue stats in processor logs for stuck jobs

### Queue Issues

1. **Jobs stuck in waiting**: Processor might not be running - check processor logs
2. **Many failed jobs**: Check processor logs for error details, jobs will retry 3 times
3. **Redis connection errors**: Verify Redis service is running and `REDIS_URL` is correct
4. **Rate limiting**: Processor limits to 100 jobs/minute - this is intentional to avoid overwhelming npm API

### High Latency

1. Check Cloudflare cache hit ratio (should be >80%)
2. Verify requests are routed to nearest region
3. Check Typesense SDN nearest node configuration
4. Ensure Typesense client uses `nearestNode` option

### Cloudflare Not Caching

1. Check `Cache-Control` headers in response
2. Verify Cloudflare proxy is enabled (orange cloud)
3. Check for `Set-Cookie` headers (prevents caching)
4. Use `cf-cache-status` header to debug
