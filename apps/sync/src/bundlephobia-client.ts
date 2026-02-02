/**
 * Bundlephobia API client for bundle size metrics
 */

import type { BundleData } from "@v1/decisions/schema";

const BUNDLEPHOBIA_API = "https://bundlephobia.com/api/size";

// Simple in-memory cache to avoid hammering the API
const cache = new Map<string, { data: BundleData | null; timestamp: number }>();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Fetch bundle size data from Bundlephobia
 */
export async function fetchBundleData(packageName: string): Promise<BundleData | null> {
  // Check cache
  const cached = cache.get(packageName);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  try {
    const response = await fetch(`${BUNDLEPHOBIA_API}?package=${encodeURIComponent(packageName)}`, {
      headers: {
        "User-Agent": "v1.run",
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      // Package might not be bundleable (native modules, etc.)
      cache.set(packageName, { data: null, timestamp: Date.now() });
      return null;
    }

    const data = await response.json();

    const bundleData: BundleData = {
      gzip: data.gzip || 0,
      size: data.size || 0,
      dependencyCount: data.dependencyCount || 0,
      hasJSModule: Boolean(data.hasJSModule),
      hasJSNext: Boolean(data.hasJSNext),
      hasSideEffects: data.hasSideEffects !== false, // default true
    };

    cache.set(packageName, { data: bundleData, timestamp: Date.now() });
    return bundleData;
  } catch (error) {
    console.error(`Bundlephobia error for ${packageName}:`, error);
    cache.set(packageName, { data: null, timestamp: Date.now() });
    return null;
  }
}

/**
 * Batch fetch bundle data with rate limiting
 */
export async function fetchBundleDataBatch(
  packageNames: string[],
  concurrency = 3,
  delayMs = 500,
): Promise<Map<string, BundleData | null>> {
  const results = new Map<string, BundleData | null>();

  for (let i = 0; i < packageNames.length; i += concurrency) {
    const batch = packageNames.slice(i, i + concurrency);
    const promises = batch.map(async (name) => {
      const data = await fetchBundleData(name);
      results.set(name, data);
    });

    await Promise.all(promises);

    // Rate limit delay between batches
    if (i + concurrency < packageNames.length) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  return results;
}
