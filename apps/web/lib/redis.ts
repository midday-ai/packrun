/**
 * Redis client for multi-region caching
 *
 * Each Railway region connects to its local Redis instance for low latency.
 * Falls back to REDIS_URL if region-specific URL is not configured.
 */

import { RedisClient } from "bun";

// Railway region identifiers
const REGION_REDIS_URLS: Record<string, string | undefined> = {
  "europe-west4-drams3a": process.env.REDIS_URL_EU,
  "us-east4-eqdc4a": process.env.REDIS_URL_US_EAST,
  "us-west2": process.env.REDIS_URL_US_WEST,
};

// Get the current region from Railway
const currentRegion = process.env.RAILWAY_REPLICA_REGION || "us-east4-eqdc4a";

// Select the appropriate Redis URL
const redisUrl = REGION_REDIS_URLS[currentRegion] || process.env.REDIS_URL;

// Create Redis client if URL is available
let redis: RedisClient | null = null;

if (redisUrl) {
  try {
    redis = new RedisClient(redisUrl);
    console.log(`Redis client created for region: ${currentRegion}`);
  } catch (error) {
    console.error("Failed to create Redis client:", error);
  }
}

/**
 * Get a value from Redis cache
 */
export async function cacheGet(key: string): Promise<string | null> {
  if (!redis) return null;

  try {
    return await redis.get(key);
  } catch (error) {
    console.error("Redis GET error:", error);
    return null;
  }
}

/**
 * Set a value in Redis cache with optional TTL
 */
export async function cacheSet(key: string, value: string, ttlSeconds?: number): Promise<void> {
  if (!redis) return;

  try {
    await redis.set(key, value);
    if (ttlSeconds) {
      await redis.expire(key, ttlSeconds);
    }
  } catch (error) {
    console.error("Redis SET error:", error);
  }
}

/**
 * Check if Redis is available
 */
export function isCacheAvailable(): boolean {
  return redis !== null;
}

/**
 * Get cache statistics (for debugging)
 */
export function getCacheInfo() {
  return {
    available: redis !== null,
    region: currentRegion,
    url: redisUrl ? "configured" : "not configured",
  };
}
