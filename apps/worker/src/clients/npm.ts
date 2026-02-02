/**
 * npm Registry API Client
 *
 * Fetches package metadata and downloads from npm registry.
 */

import { config } from "../config";

interface NpmPackageMetadata {
  name: string;
  description?: string;
  "dist-tags"?: { latest?: string };
  time?: { created?: string; modified?: string; [version: string]: string | undefined };
  keywords?: string[];
  author?: { name?: string } | string;
  license?: string;
  homepage?: string;
  repository?: { url?: string } | string;
  maintainers?: Array<{ name?: string }>;
  deprecated?: string;
  funding?: string | { url?: string } | Array<{ url?: string }>;
  versions?: {
    [version: string]: {
      types?: string;
      typings?: string;
      type?: string;
      main?: string;
      module?: string;
      exports?: unknown;
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
      peerDependencies?: Record<string, string>;
      engines?: { node?: string; npm?: string };
      scripts?: Record<string, string>;
      funding?: string | { url?: string } | Array<{ url?: string }>;
    };
  };
}

export type { NpmPackageMetadata };

interface NpmDownloadsResponse {
  downloads: number;
  package: string;
}

export async function fetchPackageMetadata(name: string): Promise<NpmPackageMetadata | null> {
  try {
    const response = await fetch(`${config.npm.registryUrl}/${encodeURIComponent(name)}`, {
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      if (response.status === 404) return null;
      throw new Error(`HTTP ${response.status}`);
    }

    return response.json();
  } catch (error) {
    console.error(`Failed to fetch metadata for ${name}:`, error);
    return null;
  }
}

export async function fetchDownloads(names: string[]): Promise<Map<string, number>> {
  const downloads = new Map<string, number>();

  // Separate scoped and non-scoped packages
  // npm bulk API doesn't support scoped packages
  const scopedPackages = names.filter((n) => n.startsWith("@"));
  const regularPackages = names.filter((n) => !n.startsWith("@"));

  // Fetch regular packages in bulk (up to 128 at a time)
  const chunks = chunkArray(regularPackages, 128);

  for (const chunk of chunks) {
    if (chunk.length === 0) continue;

    try {
      const url =
        chunk.length === 1
          ? `${config.npm.downloadsUrl}/point/last-week/${encodeURIComponent(chunk[0]!)}`
          : `${config.npm.downloadsUrl}/point/last-week/${chunk.join(",")}`;

      const response = await fetch(url);

      if (response.ok) {
        const data = await response.json();
        // Response can be single object or object with package names as keys
        if (chunk.length === 1) {
          const single = data as NpmDownloadsResponse;
          downloads.set(single.package, single.downloads);
        } else {
          for (const [pkg, info] of Object.entries(data)) {
            if (info && typeof info === "object" && "downloads" in info) {
              downloads.set(pkg, (info as NpmDownloadsResponse).downloads);
            }
          }
        }
      }
    } catch (error) {
      console.error(`Failed to fetch downloads for batch:`, error);
    }
  }

  // Fetch scoped packages individually (in parallel batches)
  const scopedChunks = chunkArray(scopedPackages, 20); // 20 concurrent requests

  for (const chunk of scopedChunks) {
    const promises = chunk.map(async (pkg) => {
      try {
        const response = await fetch(
          `${config.npm.downloadsUrl}/point/last-week/${encodeURIComponent(pkg)}`,
        );
        if (response.ok) {
          const data = (await response.json()) as NpmDownloadsResponse;
          downloads.set(data.package, data.downloads);
        }
      } catch {
        // Ignore individual failures
      }
    });

    await Promise.all(promises);
  }

  return downloads;
}

/**
 * Check if @types/{packageName} exists on npm
 */
export async function checkTypesPackage(packageName: string): Promise<string | undefined> {
  // Skip scoped packages and @types packages themselves
  if (packageName.startsWith("@")) {
    if (packageName.startsWith("@types/")) {
      return undefined;
    }
    const typesName = `@types/${packageName.slice(1).replace("/", "__")}`;
    try {
      const response = await fetch(`${config.npm.registryUrl}/${encodeURIComponent(typesName)}`, {
        method: "HEAD",
      });
      if (response.ok) {
        return typesName;
      }
    } catch {
      // Ignore errors
    }
    return undefined;
  }

  const typesName = `@types/${packageName}`;
  try {
    const response = await fetch(`${config.npm.registryUrl}/${encodeURIComponent(typesName)}`, {
      method: "HEAD",
    });
    if (response.ok) {
      return typesName;
    }
  } catch {
    // Ignore errors
  }
  return undefined;
}

/**
 * Batch check @types packages for multiple packages
 */
export async function checkTypesPackagesBatch(
  packages: Array<{ name: string; hasTypes: boolean }>,
): Promise<Map<string, string>> {
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

function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}
