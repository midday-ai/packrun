/**
 * Server-side API utilities
 *
 * This file is for SERVER-SIDE data fetching with Next.js ISR caching.
 * For CLIENT-SIDE API calls, use the oRPC client in lib/orpc/
 *
 * Server-side fetch uses Next.js built-in caching (next: { revalidate })
 * to enable ISR for static pages.
 */

// API URL (NEXT_PUBLIC_ works on both client and server)
const API_URL = process.env.NEXT_PUBLIC_API_URL;

// Package Health API
export interface PackageHealthResponse {
  name: string;
  version: string;
  description?: string;
  readme?: string;
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

    // Use absolute URL - Next.js will cache this response
    // Cloudflare caches the API response (24h), then Next.js ISR caches the page (24h)
    const url = `${API_URL}/v1/package/${encodeURIComponent(name)}`;
    const res = await fetch(url, {
      // Use Next.js fetch caching - respects Cache-Control headers from API
      // API sets s-maxage=86400 (24h) for Cloudflare, Next.js will respect this
      next: { revalidate: 86400 }, // 24 hours - matches API cache duration
      headers: {
        Accept: "application/json",
      },
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

// Vulnerability API
export interface VulnerabilityData {
  total: number;
  critical: number;
  high: number;
  moderate: number;
  low: number;
}

export interface VulnerabilityResponse {
  name: string;
  version: string;
  vulnerabilities: VulnerabilityData;
  hasVulnerabilities: boolean;
  severity: "none" | "low" | "moderate" | "high" | "critical";
}

export async function fetchVulnerabilities(
  name: string,
  version?: string,
): Promise<VulnerabilityResponse | null> {
  try {
    if (!API_URL) {
      console.warn("[api] NEXT_PUBLIC_API_URL not configured");
      return null;
    }

    const params = version ? `?version=${encodeURIComponent(version)}` : "";
    const url = `${API_URL}/v1/package/${encodeURIComponent(name)}/vulnerabilities${params}`;
    const res = await fetch(url, {
      next: { revalidate: 3600 }, // 1 hour - shorter than health since vulns change more often
      headers: {
        Accept: "application/json",
      },
    });

    if (!res.ok) {
      if (res.status === 404) return null;
      throw new Error(`API returned ${res.status}`);
    }

    return res.json();
  } catch (error) {
    console.error(`[api] Failed to fetch vulnerabilities for ${name}:`, error);
    return null;
  }
}

// Utils
export function formatDownloads(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(0)}K`;
  return num.toString();
}
