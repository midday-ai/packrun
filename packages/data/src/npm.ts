/**
 * npm Registry API Client
 *
 * Fetches package metadata and downloads from npm registry.
 */

const REGISTRY_URL = "https://registry.npmjs.org";
const DOWNLOADS_URL = "https://api.npmjs.org/downloads";
const JSDELIVR_URL = "https://cdn.jsdelivr.net/npm";

/** Standard README filenames to try (case-sensitive) */
const README_FILENAMES = ["README.md", "readme.md", "Readme.md", "README", "readme"];

/**
 * npm package metadata from registry
 */
export interface NpmPackageMetadata {
  name: string;
  description?: string;
  deprecated?: string | boolean;
  "dist-tags"?: { latest?: string; [tag: string]: string | undefined };
  time?: { created?: string; modified?: string; [version: string]: string | undefined };
  keywords?: string[];
  author?: { name?: string; email?: string; url?: string } | string;
  license?: string;
  homepage?: string;
  repository?: { type?: string; url?: string } | string;
  bugs?: { url?: string } | string;
  maintainers?: Array<{ name?: string; email?: string }>;
  readme?: string;
  funding?: string | { url?: string } | Array<{ url?: string }>;
  versions?: {
    [version: string]: NpmVersionData;
  };
}

export interface NpmVersionData {
  name: string;
  version: string;
  description?: string;
  deprecated?: string | boolean;
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
  bin?: Record<string, string>;
  sideEffects?: boolean | string[];
  os?: string[];
  cpu?: string[];
  funding?: string | { url?: string } | Array<{ url?: string }>;
  dist?: {
    tarball?: string;
    shasum?: string;
    integrity?: string;
    fileCount?: number;
    unpackedSize?: number;
    attestations?: unknown;
  };
}

export interface NpmDownloadsResponse {
  downloads: number;
  start?: string;
  end?: string;
  package: string;
}

/**
 * Fetch package metadata from npm registry
 */
export async function fetchPackageMetadata(name: string): Promise<NpmPackageMetadata | null> {
  try {
    const response = await fetch(`${REGISTRY_URL}/${encodeURIComponent(name)}`, {
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      if (response.status === 404) return null;
      throw new Error(`HTTP ${response.status}`);
    }

    return response.json();
  } catch (error) {
    console.error(`[npm] Failed to fetch metadata for ${name}:`, error);
    return null;
  }
}

/**
 * Fetch weekly downloads for a single package
 */
export async function fetchDownloads(
  name: string,
  period: "last-week" | "last-month" | "last-year" = "last-week",
): Promise<NpmDownloadsResponse | null> {
  try {
    const response = await fetch(`${DOWNLOADS_URL}/point/${period}/${encodeURIComponent(name)}`);
    if (!response.ok) return null;
    return response.json();
  } catch {
    return null;
  }
}

/**
 * Batch fetch downloads for multiple packages
 * Handles scoped packages separately (npm bulk API doesn't support them)
 */
export async function fetchDownloadsBatch(names: string[]): Promise<Map<string, number>> {
  const downloads = new Map<string, number>();

  const scopedPackages = names.filter((n) => n.startsWith("@"));
  const regularPackages = names.filter((n) => !n.startsWith("@"));

  // Fetch regular packages in bulk (up to 128 at a time)
  const chunks = chunkArray(regularPackages, 128);

  for (const chunk of chunks) {
    if (chunk.length === 0) continue;

    try {
      const url =
        chunk.length === 1
          ? `${DOWNLOADS_URL}/point/last-week/${encodeURIComponent(chunk[0]!)}`
          : `${DOWNLOADS_URL}/point/last-week/${chunk.join(",")}`;

      const response = await fetch(url);

      if (response.ok) {
        const data = await response.json();
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
      console.error(`[npm] Failed to fetch downloads for batch:`, error);
    }
  }

  // Fetch scoped packages individually (in parallel batches)
  const scopedChunks = chunkArray(scopedPackages, 20);

  for (const chunk of scopedChunks) {
    const promises = chunk.map(async (pkg) => {
      try {
        const response = await fetch(`${DOWNLOADS_URL}/point/last-week/${encodeURIComponent(pkg)}`);
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
  if (packageName.startsWith("@types/")) {
    return undefined;
  }

  const typesName = packageName.startsWith("@")
    ? `@types/${packageName.slice(1).replace("/", "__")}`
    : `@types/${packageName}`;

  try {
    const response = await fetch(`${REGISTRY_URL}/${encodeURIComponent(typesName)}`, {
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

// --- Helper functions ---

export function getLatestVersion(pkg: NpmPackageMetadata): string {
  return pkg["dist-tags"]?.latest || Object.keys(pkg.versions || {}).pop() || "0.0.0";
}

export function getVersionData(pkg: NpmPackageMetadata): NpmVersionData | undefined {
  const latest = getLatestVersion(pkg);
  return pkg.versions?.[latest];
}

export function hasBuiltInTypes(pkg: NpmPackageMetadata): boolean {
  const version = getVersionData(pkg);
  return Boolean(version?.types || version?.typings || pkg.name.startsWith("@types/"));
}

export function isESM(pkg: NpmPackageMetadata): boolean {
  const version = getVersionData(pkg);
  return Boolean(
    version?.type === "module" ||
      version?.module ||
      (version?.exports && typeof version.exports === "object"),
  );
}

export function isCJS(pkg: NpmPackageMetadata): boolean {
  const version = getVersionData(pkg);
  return Boolean(version?.main) || version?.type !== "module";
}

export function isDeprecated(pkg: NpmPackageMetadata): boolean {
  const version = getVersionData(pkg);
  return Boolean(pkg.deprecated || version?.deprecated);
}

export function getDeprecationMessage(pkg: NpmPackageMetadata): string | null {
  const version = getVersionData(pkg);
  const msg = version?.deprecated || pkg.deprecated;
  if (typeof msg === "string") return msg;
  return null;
}

export function getPublishedAt(pkg: NpmPackageMetadata): string | null {
  const latest = getLatestVersion(pkg);
  return pkg.time?.[latest] || null;
}

export function getAuthorName(pkg: NpmPackageMetadata): string | null {
  if (typeof pkg.author === "string") return pkg.author;
  return pkg.author?.name || null;
}

export function getRepositoryUrl(pkg: NpmPackageMetadata): string | null {
  if (typeof pkg.repository === "string") return pkg.repository;
  if (!pkg.repository?.url) return null;

  return pkg.repository.url
    .replace(/^git\+/, "")
    .replace(/^git:\/\//, "https://")
    .replace(/^ssh:\/\/git@/, "https://")
    .replace(/\.git$/, "");
}

// --- Logo / Avatar ---

/**
 * Get a logo URL for a package (GitHub avatar or favicon)
 */
export function getPackageLogo(pkg: NpmPackageMetadata): string | null {
  // Try GitHub avatar first (most npm packages have GitHub repos)
  const repoUrl = getRepositoryUrl(pkg);
  if (repoUrl?.includes("github.com")) {
    const match = repoUrl.match(/github\.com\/([^\/]+)/);
    if (match?.[1]) {
      return `https://github.com/${match[1]}.png?size=64`;
    }
  }

  // Fall back to favicon from homepage
  if (pkg.homepage) {
    try {
      const domain = new URL(pkg.homepage).hostname;
      return `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
    } catch {
      // Invalid URL
    }
  }

  return null;
}

/**
 * Get logo URL from a repository URL string
 */
export function getLogoFromRepoUrl(repoUrl: string | null): string | null {
  if (!repoUrl?.includes("github.com")) return null;
  const match = repoUrl.match(/github\.com\/([^\/]+)/);
  if (match?.[1]) {
    return `https://github.com/${match[1]}.png?size=64`;
  }
  return null;
}

// --- Utilities ---

function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

/**
 * Fetch README from jsdelivr CDN (serves files from npm tarball).
 * This works even when npm packument doesn't include readme field.
 * Tries multiple common README filenames.
 */
export async function fetchReadmeFromCdn(
  packageName: string,
  version?: string,
): Promise<string | null> {
  const versionSuffix = version ? `@${version}` : "";

  for (const filename of README_FILENAMES) {
    try {
      const url = `${JSDELIVR_URL}/${packageName}${versionSuffix}/${filename}`;
      const response = await fetch(url);
      if (response.ok) {
        return response.text();
      }
    } catch {
      // Try next filename
    }
  }

  return null;
}

// --- Search ---

export interface NpmSearchResult {
  name: string;
  description?: string;
  version: string;
  downloads: number;
  hasTypes: boolean;
  isESM: boolean;
  isCJS: boolean;
  author?: string;
  updated: number;
}

interface NpmSearchResponse {
  objects: Array<{
    package: {
      name: string;
      description?: string;
      version: string;
      date: string;
      author?: { name?: string };
    };
  }>;
}

/**
 * Search npm registry and fetch metadata for results
 * Used as fallback when Typesense is unavailable or has few results
 */
export async function searchNpmRegistry(query: string, limit = 20): Promise<NpmSearchResult[]> {
  try {
    const response = await fetch(
      `${REGISTRY_URL}/-/v1/search?text=${encodeURIComponent(query)}&size=${limit}`,
    );

    if (!response.ok) {
      return [];
    }

    const data: NpmSearchResponse = await response.json();
    const names = data.objects.map((obj) => obj.package.name);

    if (names.length === 0) {
      return [];
    }

    // Fetch full metadata + downloads in parallel for rich results
    const results = await Promise.all(
      names.map(async (name): Promise<NpmSearchResult | null> => {
        const [pkg, downloads] = await Promise.all([
          fetchPackageMetadata(name),
          fetchDownloads(name),
        ]);

        if (!pkg) return null;

        return {
          name: pkg.name,
          description: pkg.description,
          version: getLatestVersion(pkg),
          downloads: downloads?.downloads || 0,
          hasTypes: hasBuiltInTypes(pkg),
          isESM: isESM(pkg),
          isCJS: isCJS(pkg),
          author: getAuthorName(pkg) || undefined,
          updated: pkg.time?.modified ? new Date(pkg.time.modified).getTime() : 0,
        };
      }),
    );

    return results.filter((r): r is NpmSearchResult => r !== null);
  } catch (error) {
    console.error("[npm] Search fallback failed:", error);
    return [];
  }
}
