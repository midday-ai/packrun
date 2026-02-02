import { extractCompatibility } from "./compatibility-checker";
import { config } from "./config";
import type { PackageDocument } from "./typesense";

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

export function transformToDocument(metadata: NpmPackageMetadata, downloads = 0): PackageDocument {
  const latestVersion = metadata["dist-tags"]?.latest || "0.0.0";
  const versionData = metadata.versions?.[latestVersion];

  // Extract compatibility info
  const compatibility = versionData
    ? extractCompatibility(versionData, metadata.name)
    : {
        nodeVersion: undefined,
        isESM: false,
        isCJS: false,
        hasTypes: false,
      };

  // Get author name
  let author: string | undefined;
  if (typeof metadata.author === "string") {
    author = metadata.author;
  } else if (metadata.author?.name) {
    author = metadata.author.name;
  }

  // Get repository URL
  let repository: string | undefined;
  if (typeof metadata.repository === "string") {
    repository = metadata.repository;
  } else if (metadata.repository?.url) {
    repository = metadata.repository.url.replace(/^git\+/, "").replace(/\.git$/, "");
  }

  // Count dependencies
  const dependencies = Object.keys(versionData?.dependencies || {}).length;

  // Get maintainers
  const maintainers = metadata.maintainers
    ?.map((m) => m.name)
    .filter((n): n is string => Boolean(n));

  // Extract peer dependencies and direct dependencies as JSON strings
  const peerDeps = versionData?.peerDependencies || {};
  const directDeps = versionData?.dependencies || {};

  // Calculate maintenance score (simple heuristic)
  const lastUpdated = metadata.time?.modified
    ? new Date(metadata.time.modified).getTime()
    : Date.now();
  const daysSinceUpdate = (Date.now() - lastUpdated) / (1000 * 60 * 60 * 24);
  // Score: 1.0 = updated today, 0.0 = updated > 2 years ago
  const maintenanceScore = Math.max(0, Math.min(1, 1 - daysSinceUpdate / 730));

  // Check for install scripts (security concern)
  const scripts = versionData?.scripts || {};
  const hasInstallScripts = Boolean(scripts.preinstall || scripts.install || scripts.postinstall);

  // Extract funding URL
  let funding: string | undefined;
  const fundingData = versionData?.funding || metadata.funding;
  if (fundingData) {
    if (typeof fundingData === "string") {
      funding = fundingData;
    } else if (Array.isArray(fundingData) && fundingData[0]?.url) {
      funding = fundingData[0].url;
    } else if (typeof fundingData === "object" && "url" in fundingData) {
      funding = fundingData.url;
    }
  }

  return {
    id: metadata.name,
    name: metadata.name,
    description: metadata.description?.slice(0, 500),
    keywords: metadata.keywords?.slice(0, 20),
    author,
    version: latestVersion,
    license: metadata.license,
    homepage: metadata.homepage,
    repository,
    downloads,
    updated: lastUpdated,
    created: metadata.time?.created ? new Date(metadata.time.created).getTime() : Date.now(),
    hasTypes: compatibility.hasTypes,
    isESM: compatibility.isESM,
    isCJS: compatibility.isCJS,
    dependencies,
    maintainers: maintainers?.slice(0, 10),
    // Agent-optimized fields
    nodeVersion: compatibility.nodeVersion,
    peerDependencies: Object.keys(peerDeps).length > 0 ? JSON.stringify(peerDeps) : undefined,
    directDependencies: Object.keys(directDeps).length > 0 ? JSON.stringify(directDeps) : undefined,
    deprecated: Boolean(metadata.deprecated),
    deprecatedMessage: metadata.deprecated || undefined,
    maintenanceScore: maintenanceScore > 0 ? Math.round(maintenanceScore * 100) / 100 : undefined,
    // Security & quality fields
    hasInstallScripts: hasInstallScripts || undefined,
    funding,
  };
}

function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

/**
 * Check if @types/{packageName} exists on npm
 * Returns the @types package name if it exists, undefined otherwise
 */
export async function checkTypesPackage(packageName: string): Promise<string | undefined> {
  // Skip scoped packages and @types packages themselves
  if (packageName.startsWith("@")) {
    // For scoped packages like @org/name, types would be @types/org__name
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

  // Only check packages that don't already have types
  const packagesWithoutTypes = packages.filter((p) => !p.hasTypes);

  // Process in parallel batches of 20
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

// Stream changes from npm registry
export async function* streamChanges(since = "now"): AsyncGenerator<{
  seq: string;
  id: string;
  deleted?: boolean;
}> {
  const url = `${config.npm.replicateUrl}/_changes?since=${since}&feed=continuous&include_docs=false&heartbeat=30000`;

  const response = await fetch(url);
  if (!response.ok || !response.body) {
    throw new Error(`Failed to connect to changes feed: ${response.status}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (!line.trim()) continue;

      try {
        const change = JSON.parse(line);
        if (change.id && change.seq) {
          yield {
            seq: change.seq,
            id: change.id,
            deleted: change.deleted,
          };
        }
      } catch {
        // Heartbeat or invalid JSON, skip
      }
    }
  }
}
