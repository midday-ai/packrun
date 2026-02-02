/**
 * Redis Client for API Caching
 *
 * Uses Bun's native Redis client for high performance.
 * Provides caching helpers for enriched package data with TTL support.
 */

import { redis as defaultRedis, RedisClient } from "bun";

// Singleton Redis client using Bun's native client
let redisClient: RedisClient | null = null;

export function getRedis(): RedisClient {
  if (!redisClient) {
    // Use custom URL if provided, otherwise Bun uses REDIS_URL env automatically
    if (process.env.REDIS_URL) {
      redisClient = new RedisClient(process.env.REDIS_URL);
    } else {
      // Use the default redis client which reads from env
      redisClient = defaultRedis as unknown as RedisClient;
    }
    console.log("[Redis] Connected via Bun native client");
  }
  return redisClient;
}

// TTL constants (in seconds)
export const TTL = {
  HEALTH: 60 * 60, // 1 hour
  SCORES: 7 * 24 * 60 * 60, // 7 days
  DETAILS: 24 * 60 * 60, // 1 day
  SECURITY: 24 * 60 * 60, // 1 day
  GITHUB: 24 * 60 * 60, // 1 day
  ALTERNATIVES: 6 * 60 * 60, // 6 hours
  TREND: 24 * 60 * 60, // 1 day
} as const;

// Cache key patterns
export const CacheKey = {
  health: (name: string) => `pkg:${name}:health`,
  scores: (name: string) => `pkg:${name}:scores`,
  details: (name: string) => `pkg:${name}:details`,
  security: (name: string) => `pkg:${name}:security`,
  github: (name: string) => `pkg:${name}:github`,
  alternatives: (name: string) => `pkg:${name}:alternatives`,
  trend: (name: string) => `pkg:${name}:trend`,
} as const;

/**
 * Cache helper functions
 */
export const cache = {
  /**
   * Get a cached value, parsing JSON if present
   */
  async get<T>(key: string): Promise<T | null> {
    const redis = getRedis();
    const value = await redis.get(key);
    if (!value) return null;
    try {
      return JSON.parse(value) as T;
    } catch {
      return value as unknown as T;
    }
  },

  /**
   * Set a cached value with TTL
   */
  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    const redis = getRedis();
    const serialized = typeof value === "string" ? value : JSON.stringify(value);
    await redis.set(key, serialized);
    await redis.expire(key, ttlSeconds);
  },

  /**
   * Delete a cached value
   */
  async del(key: string): Promise<void> {
    const redis = getRedis();
    await redis.del(key);
  },

  /**
   * Get or fetch pattern - returns cached value or fetches and caches
   */
  async getOrFetch<T>(key: string, ttlSeconds: number, fetcher: () => Promise<T>): Promise<T> {
    const cached = await cache.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    const value = await fetcher();
    await cache.set(key, value, ttlSeconds);
    return value;
  },

  /**
   * Batch get multiple keys using send for MGET
   */
  async mget<T>(keys: string[]): Promise<(T | null)[]> {
    if (keys.length === 0) return [];
    const redis = getRedis();
    // Use send for MGET command
    const values = (await redis.send("MGET", keys)) as (string | null)[];
    return values.map((v) => {
      if (!v) return null;
      try {
        return JSON.parse(v) as T;
      } catch {
        return v as unknown as T;
      }
    });
  },
};

/**
 * Graceful shutdown
 */
export function closeRedis(): void {
  if (redisClient && redisClient !== defaultRedis) {
    redisClient.close();
    redisClient = null;
  }
}
