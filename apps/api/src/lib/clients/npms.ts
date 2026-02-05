/**
 * npms.io API Client for API Server
 *
 * Uses @packrun/data/npms. Cloudflare edge cache handles response caching.
 */

import { fetchNpmsScores as fetchNpmsScoresRaw, type NpmsScores } from "@packrun/data/npms";

// Re-export type
export type { NpmsScores } from "@packrun/data/npms";

/**
 * Fetch scores from npms.io
 * Cloudflare edge cache handles caching of final API responses (24h for health endpoint)
 */
export async function fetchNpmsScores(packageName: string): Promise<NpmsScores | null> {
  return fetchNpmsScoresRaw(packageName);
}
