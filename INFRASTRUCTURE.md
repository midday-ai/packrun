# Infrastructure Setup

This document describes how to deploy v1.run to Railway with multi-region support.

## Architecture

```
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
│  (web+redis) │  │(web+sync+redis)│         │  (web+redis) │
└──────┬───────┘  └──────┬───────┘           └──────┬───────┘
       │                  │                           │
       ▼                  ▼                           ▼
┌──────────────┐  ┌──────────────┐           ┌──────────────┐
│  Typesense   │  │  Typesense   │           │  Typesense   │
│  Frankfurt   │  │  Virginia    │           │  Oregon      │
└──────────────┴──┴──────────────┴───────────┴──────────────┘
                  Typesense Cloud SDN (auto-replication)
```

Each region has its own Redis instance for package data caching (~1-5ms latency).
Cache misses fetch from npm registry and populate the regional cache.

## Prerequisites

1. **Railway Pro Plan** - Required for multi-region replicas
2. **Typesense Cloud Account** - With SDN (Search Delivery Network) enabled
3. **GitHub Repository** - Connected to Railway

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
4. Railway will auto-detect both `apps/web` and `apps/sync` as deployable packages
5. Click **Deploy** to create both services

Railway will automatically:
- Find `railway.json` in each app directory
- Configure Dockerfile builds
- Set up multi-region replicas (web) and single-region (sync)
- Configure healthchecks and restart policies

### Manual Setup (Alternative)

If auto-import doesn't work:

1. Create an empty project
2. Add two services from the same repo
3. For each service, set the **Railway Config File** path:
   - Web: `/apps/web/railway.json`
   - Sync: `/apps/sync/railway.json`

### Config as Code

Both services are configured via `railway.json` files:

**Web Service** (`apps/web/railway.json`):
- Multi-region replicas: Amsterdam, Virginia, California
- Healthcheck at `/api/health`
- Watch patterns to only rebuild on relevant changes

**Sync Worker** (`apps/sync/railway.json`):
- Single region: US East (Virginia)
- Always restart policy
- Watch patterns for sync-related files only

## Step 3: Redis Setup (Package Caching)

Each region needs its own Redis instance for low-latency package data caching.

### Deploy Redis Instances

For each region (Amsterdam, Virginia, California):

1. In Railway project, click **Add Service** → **Database** → **Redis**
2. Name it according to region: `redis-eu`, `redis-use`, `redis-usw`
3. Set the region to match the web app replica's region:
   - `redis-eu` → EU West (Amsterdam)
   - `redis-use` → US East (Virginia)
   - `redis-usw` → US West (California)

### Railway Project Structure

```
v1-run (Project)
├── web (Service) - 3 replicas
├── sync-worker (Service) - 1 replica
├── redis-eu (Redis) - Amsterdam
├── redis-use (Redis) - Virginia
└── redis-usw (Redis) - California
```

## Step 4: Environment Variables

### Web Service Variables

| Variable | Description |
|----------|-------------|
| `TYPESENSE_API_KEY` | Admin API key from Typesense Cloud |
| `NEXT_PUBLIC_TYPESENSE_SEARCH_API_KEY` | Search-only API key (public) |
| `REDIS_URL_EU` | Redis URL for EU region (from `redis-eu` service) |
| `REDIS_URL_US_EAST` | Redis URL for US East region (from `redis-use` service) |
| `REDIS_URL_US_WEST` | Redis URL for US West region (from `redis-usw` service) |
| `REDIS_URL` | Fallback Redis URL (optional) |

**Note**: Railway automatically sets `RAILWAY_REPLICA_REGION` for each replica, which the app uses to connect to the correct regional Redis.

### Sync Worker Variables

| Variable | Description |
|----------|-------------|
| `TYPESENSE_API_KEY` | Admin API key from Typesense Cloud |
| `TYPESENSE_HOST` | (Optional) Override default host |

## Step 5: Custom Domain

1. In Railway, go to Web service → **Settings** → **Networking**
2. Click **Generate Domain** or **Add Custom Domain**
3. For custom domain:
   - Add a CNAME record pointing to Railway
   - Railway will auto-provision SSL

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

### Check Sync Worker Logs

In Railway dashboard, go to Sync Worker → **Deployments** → **View Logs**

You should see:
```
npm Sync Worker starting...
Typesense: xxx.a1.typesense.net:443
Starting npm changes listener...
Listening for changes from: now
```

## Monitoring

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

## Troubleshooting

### Healthcheck Failing

1. Check if the app builds successfully
2. Verify environment variables are set
3. Check deployment logs for errors

### Sync Worker Not Processing

1. Verify `TYPESENSE_API_KEY` is set correctly
2. Check if npm registry is accessible
3. Look for rate limiting errors in logs

### High Latency

1. Verify requests are routed to nearest region
2. Check Typesense SDN nearest node configuration
3. Ensure Typesense client uses `nearestNode` option
4. Check Redis is deployed in the same region as the web replica

### Redis Cache Issues

1. Verify `REDIS_URL_*` environment variables are set correctly
2. Check Redis service is running in Railway dashboard
3. Ensure Redis is in the same region as the web replica for low latency
4. Check logs for "Redis connected to region" message on startup
