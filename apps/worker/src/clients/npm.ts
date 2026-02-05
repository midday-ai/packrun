/**
 * npm Registry API Client for Worker
 *
 * Re-exports from @packrun/data/npm with worker-specific additions.
 * Includes Redis-cached versions of download fetching.
 */

import { fetchDownloadsBatch } from "@packrun/data/npm";
import { getCachedDownloadsBatch, setCachedDownloadsBatch } from "../lib/redis-cache";

// Re-export everything from shared package
// Re-export batch function with original name for backwards compatibility
export {
  checkTypesPackage,
  fetchDownloads as fetchSingleDownloads,
  fetchDownloadsBatch as fetchDownloadsUncached,
  fetchPackageMetadata,
  getAuthorName,
  getDeprecationMessage,
  getLatestVersion,
  getPublishedAt,
  getRepositoryUrl,
  getVersionData,
  hasBuiltInTypes,
  isCJS,
  isDeprecated,
  isESM,
  type NpmDownloadsResponse,
  type NpmPackageMetadata,
  type NpmVersionData,
} from "@packrun/data/npm";

/**
 * Fetch downloads with Redis cache (24h TTL)
 *
 * 1. Check Redis for cached values
 * 2. Fetch missing from npm API
 * 3. Store fresh values in Redis
 * 4. Return merged results
 */
export async function fetchDownloads(names: string[]): Promise<Map<string, number>> {
  if (names.length === 0) return new Map();

  // 1. Check Redis cache for all names
  const cached = await getCachedDownloadsBatch(names);

  // 2. Find which ones are missing from cache
  const missing = names.filter((name) => !cached.has(name));

  if (missing.length === 0) {
    // All found in cache
    return cached;
  }

  // 3. Fetch missing from npm API
  const fresh = await fetchDownloadsBatch(missing);

  // 4. Store fresh values in Redis cache
  if (fresh.size > 0) {
    await setCachedDownloadsBatch(fresh);
  }

  // 5. Merge cached and fresh results
  const results = new Map(cached);
  for (const [name, count] of fresh) {
    results.set(name, count);
  }

  return results;
}

/**
 * Batch check @types packages for multiple packages
 * Worker-specific: uses batch processing for efficiency
 */
export async function checkTypesPackagesBatch(
  packages: Array<{ name: string; hasTypes: boolean }>,
): Promise<Map<string, string>> {
  const { checkTypesPackage } = await import("@packrun/data/npm");
  const results = new Map<string, string>();
  const packagesWithoutTypes = packages.filter((p) => !p.hasTypes);
  const batchSize = 20;

  for (let i = 0; i < packagesWithoutTypes.length; i += batchSize) {
    const batch = packagesWithoutTypes.slice(i, i + batchSize);
    const promises = batch.map(async (pkg) => {
      const typesPackage = await checkTypesPackage(pkg.name);
      if (typesPackage) {
        results.set(pkg.name, typesPackage);
      }
    });
    await Promise.all(promises);
  }

  return results;
}
