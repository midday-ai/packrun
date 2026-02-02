/**
 * Bundlephobia API Client
 *
 * Fetches bundle size metrics from Bundlephobia.
 */

const BUNDLEPHOBIA_API = "https://bundlephobia.com/api/size";

/**
 * Bundle size data
 */
export interface BundleData {
  gzip: number;
  size: number;
  dependencyCount: number;
  hasJSModule: boolean;
  hasJSNext: boolean;
  hasSideEffects: boolean;
}

/**
 * Fetch bundle size data from Bundlephobia
 */
export async function fetchBundleData(packageName: string): Promise<BundleData | null> {
  try {
    const response = await fetch(`${BUNDLEPHOBIA_API}?package=${encodeURIComponent(packageName)}`, {
      headers: {
        "User-Agent": "v1.run",
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();

    return {
      gzip: data.gzip || 0,
      size: data.size || 0,
      dependencyCount: data.dependencyCount || 0,
      hasJSModule: Boolean(data.hasJSModule),
      hasJSNext: Boolean(data.hasJSNext),
      hasSideEffects: data.hasSideEffects !== false,
    };
  } catch (error) {
    console.error(`[Bundlephobia] Error for ${packageName}:`, error);
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

    if (i + concurrency < packageNames.length) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  return results;
}
