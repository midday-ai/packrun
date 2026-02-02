/**
 * API Client for Web App
 *
 * Fetches data from the v1.run API server instead of directly from npm.
 * This ensures consistent data and leverages Typesense + Redis caching.
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || process.env.API_URL || "http://localhost:3001";

/**
 * Package health response from API
 */
export interface PackageHealthResponse {
  name: string;
  version: string;
  description?: string;
  category?: string;

  health: {
    score: number;
    grade: "A" | "B" | "C" | "D" | "F";
    status: "active" | "stable" | "maintenance-mode" | "deprecated" | "abandoned";
    signals: {
      positive: string[];
      negative: string[];
      warnings: string[];
    };
  };

  security: {
    vulnerabilities: {
      total: number;
      critical: number;
      high: number;
      medium: number;
      low: number;
    };
    supplyChain: {
      hasProvenance: boolean;
      hasInstallScripts: boolean;
      hasGitDeps: boolean;
      hasHttpDeps: boolean;
      maintainersCount: number;
    };
    license: {
      spdx?: string;
      type?: string;
      risk: "low" | "medium" | "high" | "unknown";
    };
  };

  quality: {
    hasReadme: boolean;
    readmeSize: number;
    hasTests: boolean;
    hasTestScript: boolean;
    isStable: boolean;
    scores?: {
      quality: number;
      popularity: number;
      maintenance: number;
      final: number;
    };
  };

  compatibility: {
    types: "built-in" | "@types" | "none";
    typesPackage?: string;
    moduleFormat?: string;
    sideEffects?: boolean;
    engines?: { node?: string; npm?: string };
    os?: string[];
    cpu?: string[];
  };

  size: {
    unpackedSize?: number;
    unpackedSizeHuman?: string;
    fileCount?: number;
    dependencies: number;
  };

  popularity: {
    weeklyDownloads: number;
    downloadTrend?: string;
    dependents?: number;
    stars?: number;
  };

  activity: {
    lastUpdated: string;
    lastReleaseAge: number;
    maintainersCount: number;
  };

  github?: {
    stars: number;
    forks: number;
    openIssues: number;
    lastCommit: string;
    pushedAt: string;
    isArchived: boolean;
    topics: string[];
    language: string | null;
  };

  author?: {
    name?: string;
    github?: string;
  };

  funding?: {
    url?: string;
    platforms: string[];
  };

  cli?: {
    isCLI: boolean;
    commands: string[];
  };

  links: {
    npm: string;
    homepage?: string;
    repository?: string;
    bugs?: string;
  };

  replacement?: {
    type: "native" | "optimisation" | "none";
    useInstead?: string;
    alternatives?: string[];
    reason?: string;
    url?: string;
    example?: string;
  };

  alternatives: Array<{
    name: string;
    downloads: number;
    stars?: number;
    healthScore?: number;
    reason?: string;
  }>;

  recommendation: string;
}

/**
 * Search result from API
 */
export interface SearchResult {
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

export interface SearchResponse {
  hits: SearchResult[];
  found: number;
  page: number;
}

/**
 * Fetch package health from API
 */
export async function fetchPackageHealth(name: string): Promise<PackageHealthResponse | null> {
  try {
    const response = await fetch(`${API_URL}/api/package/${encodeURIComponent(name)}/health`, {
      next: { revalidate: 3600 }, // ISR: revalidate every hour
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      if (response.status === 404) return null;
      console.error(`API error for ${name}: ${response.status}`);
      return null;
    }

    return response.json();
  } catch (error) {
    console.error(`Failed to fetch health for ${name}:`, error);
    return null;
  }
}

/**
 * Search packages via API
 */
export async function searchPackagesViaApi(
  query: string,
  options: { page?: number; perPage?: number } = {},
): Promise<SearchResponse> {
  const { page = 1, perPage = 20 } = options;

  try {
    const params = new URLSearchParams({
      q: query,
      page: String(page),
      per_page: String(perPage),
    });

    const response = await fetch(`${API_URL}/api/search?${params}`, {
      next: { revalidate: 60 }, // Cache search results for 1 minute
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      console.error(`Search API error: ${response.status}`);
      return { hits: [], found: 0, page: 1 };
    }

    return response.json();
  } catch (error) {
    console.error("Search API failed:", error);
    return { hits: [], found: 0, page: 1 };
  }
}
