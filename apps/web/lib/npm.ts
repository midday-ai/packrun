/**
 * npm Registry API client for the web app
 *
 * Used as fallback when Typesense has few/no search results.
 */

const REGISTRY_URL = "https://registry.npmjs.org";
const DOWNLOADS_URL = "https://api.npmjs.org/downloads";

interface PackageMetadata {
  name: string;
  description?: string;
  "dist-tags"?: { latest?: string; [tag: string]: string | undefined };
  time?: { modified?: string };
  author?: { name?: string } | string;
  versions?: {
    [version: string]: {
      types?: string;
      typings?: string;
      type?: string;
      main?: string;
      module?: string;
      exports?: unknown;
    };
  };
}

interface DownloadsData {
  downloads: number;
}

async function getPackage(name: string): Promise<PackageMetadata | null> {
  try {
    const response = await fetch(`${REGISTRY_URL}/${encodeURIComponent(name)}`, {
      next: { revalidate: 3600 },
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

async function getDownloads(name: string): Promise<DownloadsData | null> {
  try {
    const response = await fetch(`${DOWNLOADS_URL}/point/last-week/${encodeURIComponent(name)}`, {
      next: { revalidate: 3600 },
    });

    if (!response.ok) return null;
    return response.json();
  } catch {
    return null;
  }
}

function getLatestVersion(pkg: PackageMetadata): string {
  return pkg["dist-tags"]?.latest || Object.keys(pkg.versions || {}).pop() || "0.0.0";
}

function hasTypes(pkg: PackageMetadata): boolean {
  const latest = getLatestVersion(pkg);
  const version = pkg.versions?.[latest];
  return Boolean(version?.types || version?.typings || pkg.name.startsWith("@types/"));
}

function isESM(pkg: PackageMetadata): boolean {
  const latest = getLatestVersion(pkg);
  const version = pkg.versions?.[latest];
  return Boolean(
    version?.type === "module" ||
      version?.module ||
      (version?.exports && typeof version.exports === "object"),
  );
}

function isCJS(pkg: PackageMetadata): boolean {
  const latest = getLatestVersion(pkg);
  const version = pkg.versions?.[latest];
  return Boolean(version?.main) || version?.type !== "module";
}

function getAuthorName(pkg: PackageMetadata): string | null {
  if (typeof pkg.author === "string") return pkg.author;
  return pkg.author?.name || null;
}

/**
 * Search npm registry and fetch metadata for results
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
      names.map(async (name): Promise<NpmSearchResult | null> => {
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
