/**
 * Simple in-memory LRU cache for MCP tool results
 *
 * Provides fast caching for tool calls to improve MCP response times.
 * Cache is per-instance (not shared across regions) and cleared on restart.
 */

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

class LRUCache<T> {
  private cache = new Map<string, CacheEntry<T>>();
  private maxSize: number;
  private defaultTTL: number;

  constructor(maxSize = 1000, defaultTTL = 3600000) {
    // Default: 1000 entries, 1 hour TTL
    this.maxSize = maxSize;
    this.defaultTTL = defaultTTL;
  }

  get(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    // Move to end (most recently used)
    this.cache.delete(key);
    this.cache.set(key, entry);

    return entry.value;
  }

  set(key: string, value: T, ttl?: number): void {
    const expiresAt = Date.now() + (ttl ?? this.defaultTTL);

    // If key exists, update it
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }
    // If cache is full, remove oldest (first) entry
    else if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) this.cache.delete(firstKey);
    }

    this.cache.set(key, { value, expiresAt });
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }
}

// Export LRUCache class for typed instances
export { LRUCache };

// Cache instances for different data types
export const healthCache = new LRUCache<any>(500, 3600000); // 500 entries, 1 hour TTL
export const versionCache = new LRUCache<any>(1000, 1800000); // 1000 entries, 30 min TTL
export const compareCache = new LRUCache<any>(200, 1800000); // 200 entries, 30 min TTL
export const downloadsCache = new LRUCache<any>(1000, 86400000); // 1000 entries, 24 hours TTL
export const installSizeCache = new LRUCache<any>(500, 604800000); // 500 entries, 7 days TTL
