/**
 * npm Registry API client for the web app
 */

const REGISTRY_URL = "https://registry.npmjs.org";
const DOWNLOADS_URL = "https://api.npmjs.org/downloads";

export interface PackageMetadata {
  name: string;
  description?: string;
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
  versions?: {
    [version: string]: {
      name: string;
      version: string;
      description?: string;
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
      dist?: {
        tarball?: string;
        shasum?: string;
        integrity?: string;
        fileCount?: number;
        unpackedSize?: number;
      };
    };
  };
}

export interface DownloadsData {
  downloads: number;
  start: string;
  end: string;
  package: string;
}

export async function getPackage(name: string): Promise<PackageMetadata | null> {
  try {
    const response = await fetch(`${REGISTRY_URL}/${encodeURIComponent(name)}`, {
      next: { revalidate: 3600 }, // Cache for 1 hour
    });

    if (!response.ok) {
      if (response.status === 404) return null;
      throw new Error(`HTTP ${response.status}`);
    }

    return response.json();
  } catch (error) {
    console.error(`Failed to fetch package ${name}:`, error);
    return null;
  }
}

export async function getDownloads(
  name: string,
  period: "last-week" | "last-month" | "last-year" = "last-week",
): Promise<DownloadsData | null> {
  try {
    const response = await fetch(`${DOWNLOADS_URL}/point/${period}/${encodeURIComponent(name)}`, {
      next: { revalidate: 3600 },
    });

    if (!response.ok) return null;
    return response.json();
  } catch {
    return null;
  }
}

export function getLatestVersion(pkg: PackageMetadata): string {
  return pkg["dist-tags"]?.latest || Object.keys(pkg.versions || {}).pop() || "0.0.0";
}

export function hasTypes(pkg: PackageMetadata): boolean {
  const latest = getLatestVersion(pkg);
  const version = pkg.versions?.[latest];
  return Boolean(version?.types || version?.typings || pkg.name.startsWith("@types/"));
}

export function isESM(pkg: PackageMetadata): boolean {
  const latest = getLatestVersion(pkg);
  const version = pkg.versions?.[latest];
  return Boolean(
    version?.type === "module" ||
      version?.module ||
      (version?.exports && typeof version.exports === "object"),
  );
}

export function isCJS(pkg: PackageMetadata): boolean {
  const latest = getLatestVersion(pkg);
  const version = pkg.versions?.[latest];
  return Boolean(version?.main) || version?.type !== "module";
}

export function getAuthorName(pkg: PackageMetadata): string | null {
  if (typeof pkg.author === "string") return pkg.author;
  return pkg.author?.name || null;
}

export function getRepoUrl(pkg: PackageMetadata): string | null {
  if (typeof pkg.repository === "string") return pkg.repository;
  if (!pkg.repository?.url) return null;

  return pkg.repository.url
    .replace(/^git\+/, "")
    .replace(/^git:\/\//, "https://")
    .replace(/\.git$/, "");
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} kB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatNumber(num: number): string {
  if (num >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(1)}B`;
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return num.toLocaleString();
}

export function timeAgo(date: string): string {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);

  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 2592000) return `${Math.floor(seconds / 86400)}d ago`;
  if (seconds < 31536000) return `${Math.floor(seconds / 2592000)}mo ago`;
  return `${Math.floor(seconds / 31536000)}y ago`;
}

/**
 * Search npm registry and fetch full metadata for results
 * Used as fallback when Typesense has few/no results
 */
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

export async function searchNpmPackages(query: string, limit = 20): Promise<NpmSearchResult[]> {
  try {
    const response = await fetch(
      `https://registry.npmjs.org/-/v1/search?text=${encodeURIComponent(query)}&size=${limit}`,
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
      names.map(async (name) => {
        const [pkg, downloads] = await Promise.all([getPackage(name), getDownloads(name)]);

        if (!pkg) return null;

        return {
          name: pkg.name,
          description: pkg.description,
          version: getLatestVersion(pkg),
          downloads: downloads?.downloads || 0,
          hasTypes: hasTypes(pkg),
          isESM: isESM(pkg),
          isCJS: isCJS(pkg),
          author: getAuthorName(pkg) || undefined,
          updated: pkg.time?.modified ? new Date(pkg.time.modified).getTime() : 0,
        };
      }),
    );

    return results.filter((r): r is NpmSearchResult => r !== null);
  } catch (error) {
    console.error("npm search fallback failed:", error);
    return [];
  }
}
