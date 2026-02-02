// API URL (NEXT_PUBLIC_ works on both client and server)
const API_URL = process.env.NEXT_PUBLIC_API_URL;

// Search API
export interface SearchResult {
  name: string;
  description?: string;
  version: string;
  downloads: number;
  hasTypes?: boolean;
}

export async function searchPackages(query: string): Promise<SearchResult[]> {
  if (!query.trim()) return [];
  if (!API_URL) {
    console.warn("[api] NEXT_PUBLIC_API_URL not configured");
    return [];
  }

  const res = await fetch(`${API_URL}/search?q=${encodeURIComponent(query)}&limit=10`);
  if (!res.ok) throw new Error("Search failed");

  const data = await res.json();
  return (data.hits || []).map((hit: Record<string, unknown>) => ({
    name: hit.name || hit.id,
    description: hit.description || "",
    version: hit.version || "",
    downloads: hit.downloads || 0,
    hasTypes: hit.hasTypes || false,
  }));
}

// Package Health API
export interface PackageHealthResponse {
  name: string;
  version: string;
  description?: string;
  author?: { name?: string; email?: string };
  links: {
    npm?: string;
    homepage?: string;
    repository?: string;
    bugs?: string;
  };
  health: {
    score: number;
    grade: string;
    status: "healthy" | "warning" | "critical" | "deprecated" | "unknown";
    signals: Array<{
      type: string;
      severity: "info" | "warning" | "critical";
      message: string;
    }>;
  };
  popularity: {
    weeklyDownloads: number;
    stars?: number;
    dependents?: number;
    npmScore?: number;
  };
  activity: {
    lastUpdated: string;
    lastCommit?: string;
    commitFrequency?: string;
    releaseFrequency?: string;
    isStale: boolean;
  };
  security: {
    vulnerabilities: {
      total: number;
      critical?: number;
      high?: number;
      moderate?: number;
      low?: number;
    };
    license: {
      spdx?: string;
      isOsiApproved?: boolean;
    };
    supplyChain: {
      hasInstallScripts?: boolean;
      hasLockfile?: boolean;
    };
  };
  compatibility: {
    types: "bundled" | "separate" | "none";
    typesPackage?: string;
    moduleFormat: "esm" | "cjs" | "dual" | "unknown";
    engines?: { node?: string };
  };
  size: {
    unpackedSize?: number;
    gzipSize?: number;
    dependencies: number;
  };
  replacement?: {
    type: "native" | "alternative" | "none";
    name?: string;
    useInstead?: string;
    reason?: string;
    isNative?: boolean;
  };
  alternatives?: Array<{
    name: string;
    downloads: number;
    description?: string;
  }>;
  github?: {
    stars?: number;
    forks?: number;
    issues?: number;
    watchers?: number;
  };
  funding?: {
    url?: string;
    type?: string;
  };
}

export async function fetchPackageHealth(name: string): Promise<PackageHealthResponse | null> {
  try {
    if (!API_URL) {
      console.warn("[api] NEXT_PUBLIC_API_URL not configured");
      return null;
    }

    const res = await fetch(`${API_URL}/api/package/${encodeURIComponent(name)}`, {
      next: { revalidate: 86400 }, // Cache for 24 hours (on-demand invalidation handles updates)
    });

    if (!res.ok) {
      if (res.status === 404) return null;
      throw new Error(`API returned ${res.status}`);
    }

    return res.json();
  } catch (error) {
    console.error(`[api] Failed to fetch health for ${name}:`, error);
    return null;
  }
}

// Utils
export function formatDownloads(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(0)}K`;
  return num.toString();
}
