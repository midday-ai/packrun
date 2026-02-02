/**
 * npms.io API Client for API Server
 *
 * Uses @v1/data/npms with Redis caching layer.
 */

import { fetchNpmsScores as fetchNpmsScoresRaw, type NpmsScores } from "@v1/data/npms";
import { CacheKey, cache, TTL } from "../redis";

// Re-export type
export type { NpmsScores } from "@v1/data/npms";

/**
 * Fetch scores from npms.io with caching
 */
export async function fetchNpmsScores(packageName: string): Promise<NpmsScores | null> {
  const cacheKey = CacheKey.scores(packageName);

  // Check cache first
  const cached = await cache.get<NpmsScores>(cacheKey);
  if (cached) return cached;

  // Fetch from shared client
  const scores = await fetchNpmsScoresRaw(packageName);

  if (scores) {
    // Cache for 7 days
    await cache.set(cacheKey, scores, TTL.SCORES);
  }

  return scores;
}
