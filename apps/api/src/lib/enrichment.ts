/**
 * Package Enrichment Library
 *
 * Computes enriched data from npm packument on-demand and caches in Redis.
 * This includes details, security signals, and other computed data.
 */

import { CacheKey, cache, TTL } from "./redis";

const NPM_REGISTRY = "https://registry.npmjs.org";

/**
 * Package details from packument
 */
export interface PackageDetails {
  binCommands: string[];
  fileCount?: number;
  engineNode?: string;
  engineNpm?: string;
  os?: string[];
  cpu?: string[];
  sideEffects?: boolean;
  isMonorepo: boolean;
  bugsUrl?: string;
  contributorsCount: number;
  maintainersCount: number;
  fundingUrl?: string;
  fundingPlatforms: string[];
}

/**
 * Security signals from packument
 */
export interface SecuritySignals {
  hasGitDeps: boolean;
  hasHttpDeps: boolean;
  scriptsPreinstall: boolean;
  scriptsPostinstall: boolean;
  hasTests: boolean;
  hasTestScript: boolean;
  readmeSize: number;
}

/**
 * Download trend analysis
 */
export interface DownloadTrend {
  trend: "growing" | "stable" | "declining";
  percentChange: number;
}

interface NpmPackument {
  name: string;
  readme?: string;
  maintainers?: Array<{ name?: string }>;
  contributors?: Array<{ name?: string }>;
  bugs?: string | { url?: string };
  funding?: string | { url?: string } | Array<{ url?: string }>;
  "dist-tags"?: { latest?: string };
  versions?: {
    [version: string]: {
      bin?: Record<string, string>;
      scripts?: Record<string, string>;
      dependencies?: Record<string, string>;
      engines?: { node?: string; npm?: string };
      os?: string[];
      cpu?: string[];
      sideEffects?: boolean;
      workspaces?: unknown;
      funding?: string | { url?: string } | Array<{ url?: string }>;
      dist?: {
        fileCount?: number;
      };
    };
  };
}

/**
 * Fetch packument from npm registry
 */
async function fetchPackument(packageName: string): Promise<NpmPackument | null> {
  try {
    const response = await fetch(`${NPM_REGISTRY}/${encodeURIComponent(packageName)}`, {
      headers: {
        Accept: "application/json",
        "User-Agent": "v1.run-api",
      },
    });

    if (!response.ok) return null;
    return response.json();
  } catch {
    return null;
  }
}

/**
 * Extract package details from packument
 */
export async function getPackageDetails(packageName: string): Promise<PackageDetails | null> {
  const cacheKey = CacheKey.details(packageName);

  // Check cache first
  const cached = await cache.get<PackageDetails>(cacheKey);
  if (cached) return cached;

  const packument = await fetchPackument(packageName);
  if (!packument) return null;

  const latestVersion = packument["dist-tags"]?.latest;
  const versionData = latestVersion ? packument.versions?.[latestVersion] : undefined;

  // Extract bin commands
  const binCommands = versionData?.bin ? Object.keys(versionData.bin) : [];

  // Extract bugs URL
  let bugsUrl: string | undefined;
  if (typeof packument.bugs === "string") {
    bugsUrl = packument.bugs;
  } else if (packument.bugs?.url) {
    bugsUrl = packument.bugs.url;
  }

  // Extract funding
  let fundingUrl: string | undefined;
  const fundingPlatforms: string[] = [];
  const funding = versionData?.funding || packument.funding;
  if (funding) {
    const fundingArray = Array.isArray(funding) ? funding : [funding];
    for (const f of fundingArray) {
      const url = typeof f === "string" ? f : f?.url;
      if (url) {
        if (!fundingUrl) fundingUrl = url;
        if (url.includes("github.com/sponsors")) fundingPlatforms.push("github");
        else if (url.includes("opencollective.com")) fundingPlatforms.push("opencollective");
        else if (url.includes("patreon.com")) fundingPlatforms.push("patreon");
        else if (url.includes("ko-fi.com")) fundingPlatforms.push("ko-fi");
        else fundingPlatforms.push("other");
      }
    }
  }

  const details: PackageDetails = {
    binCommands,
    fileCount: versionData?.dist?.fileCount,
    engineNode: versionData?.engines?.node,
    engineNpm: versionData?.engines?.npm,
    os: versionData?.os,
    cpu: versionData?.cpu,
    sideEffects: versionData?.sideEffects,
    isMonorepo: Boolean(versionData?.workspaces),
    bugsUrl,
    contributorsCount: packument.contributors?.length ?? 0,
    maintainersCount: packument.maintainers?.length ?? 0,
    fundingUrl,
    fundingPlatforms: [...new Set(fundingPlatforms)],
  };

  // Cache for 1 day
  await cache.set(cacheKey, details, TTL.DETAILS);

  return details;
}

/**
 * Extract security signals from packument
 */
export async function getSecuritySignals(packageName: string): Promise<SecuritySignals | null> {
  const cacheKey = CacheKey.security(packageName);

  // Check cache first
  const cached = await cache.get<SecuritySignals>(cacheKey);
  if (cached) return cached;

  const packument = await fetchPackument(packageName);
  if (!packument) return null;

  const latestVersion = packument["dist-tags"]?.latest;
  const versionData = latestVersion ? packument.versions?.[latestVersion] : undefined;
  const deps = versionData?.dependencies || {};
  const scripts = versionData?.scripts || {};

  const signals: SecuritySignals = {
    hasGitDeps: Object.values(deps).some(
      (v) => v.startsWith("git://") || v.startsWith("git+") || v.includes("github:"),
    ),
    hasHttpDeps: Object.values(deps).some((v) => v.startsWith("http://")),
    scriptsPreinstall: Boolean(scripts.preinstall),
    scriptsPostinstall: Boolean(scripts.postinstall),
    hasTests: Boolean(scripts.test && scripts.test !== 'echo "Error: no test specified" && exit 1'),
    hasTestScript: Boolean(scripts.test),
    readmeSize: packument.readme?.length ?? 0,
  };

  // Cache for 1 day
  await cache.set(cacheKey, signals, TTL.SECURITY);

  return signals;
}

/**
 * Compute download trend from npm downloads API
 */
export async function getDownloadTrend(packageName: string): Promise<DownloadTrend | null> {
  const cacheKey = CacheKey.trend(packageName);

  // Check cache first
  const cached = await cache.get<DownloadTrend>(cacheKey);
  if (cached) return cached;

  try {
    // Fetch last week and 3 months ago
    const [recentRes, oldRes] = await Promise.all([
      fetch(`https://api.npmjs.org/downloads/point/last-week/${encodeURIComponent(packageName)}`),
      fetch(`https://api.npmjs.org/downloads/point/last-month/${encodeURIComponent(packageName)}`),
    ]);

    if (!recentRes.ok || !oldRes.ok) return null;

    const recent = (await recentRes.json()) as { downloads: number };
    const old = (await oldRes.json()) as { downloads: number };

    // Normalize to weekly (month / 4)
    const oldWeekly = old.downloads / 4;
    const percentChange =
      oldWeekly > 0 ? Math.round(((recent.downloads - oldWeekly) / oldWeekly) * 100) : 0;

    let trend: "growing" | "stable" | "declining";
    if (percentChange > 10) trend = "growing";
    else if (percentChange < -10) trend = "declining";
    else trend = "stable";

    const result: DownloadTrend = { trend, percentChange };

    // Cache for 1 day
    await cache.set(cacheKey, result, TTL.TREND);

    return result;
  } catch {
    return null;
  }
}
