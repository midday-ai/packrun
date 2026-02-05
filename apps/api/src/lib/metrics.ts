/**
 * Package metrics fetcher for comparison engine
 *
 * Cloudflare edge cache handles caching of final API responses (6h for compare endpoint)
 */

import type { BundleData, PackageMetrics } from "@packrun/decisions/schema";
import { api as log } from "@packrun/logger";
import { fetchGitHubData } from "./clients/github";
import { fetchPackageMetadata } from "./clients/npm";

const BUNDLEPHOBIA_API = "https://bundlephobia.com/api/size";
const NPM_DOWNLOADS = "https://api.npmjs.org/downloads";

/**
 * Fetch complete metrics for a package
 */
export async function fetchPackageMetrics(packageName: string): Promise<PackageMetrics | null> {
  try {
    // Fetch all data in parallel
    const [npmData, downloadData, bundleData] = await Promise.all([
      fetchPackageMetadata(packageName),
      fetchDownloadRange(packageName),
      fetchBundleData(packageName),
    ]);

    if (!npmData) return null;

    // Fetch GitHub data if available
    let githubData = null;
    const repoUrl = extractGitHubUrl(npmData.repository);
    if (repoUrl) {
      githubData = await fetchGitHubData(repoUrl);
    }

    const metrics = buildMetrics(packageName, npmData, downloadData, bundleData, githubData);

    return metrics;
  } catch (error) {
    log.error(`Error fetching metrics for ${packageName}:`, error);
    return null;
  }
}

/**
 * Fetch download history (90 days)
 */
async function fetchDownloadRange(packageName: string) {
  try {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 90);

    const formatDate = (d: Date) => d.toISOString().split("T")[0];

    const res = await fetch(
      `${NPM_DOWNLOADS}/range/${formatDate(startDate)}:${formatDate(endDate)}/${encodeURIComponent(packageName)}`,
    );
    if (!res.ok) return null;

    const data = await res.json();
    return data.downloads || [];
  } catch {
    return null;
  }
}

/**
 * Fetch bundle size from Bundlephobia
 */
async function fetchBundleData(packageName: string): Promise<BundleData | null> {
  try {
    const res = await fetch(`${BUNDLEPHOBIA_API}?package=${encodeURIComponent(packageName)}`);
    if (!res.ok) return null;

    const data = await res.json();
    return {
      gzip: data.gzip || 0,
      size: data.size || 0,
      dependencyCount: data.dependencyCount || 0,
      hasJSModule: Boolean(data.hasJSModule),
      hasJSNext: Boolean(data.hasJSNext),
      hasSideEffects: data.hasSideEffects !== false,
    };
  } catch {
    return null;
  }
}

/**
 * Extract GitHub URL from repository field
 */
function extractGitHubUrl(repository: string | { url?: string } | undefined): string | null {
  if (!repository) return null;
  const url = typeof repository === "string" ? repository : repository.url;
  if (!url) return null;
  const cleaned = url.replace(/^git\+/, "").replace(/\.git$/, "");
  if (!cleaned.includes("github.com")) return null;
  return cleaned;
}

/**
 * Build PackageMetrics from fetched data
 */
function buildMetrics(
  name: string,
  npmData: any,
  downloadData: any[] | null,
  bundleData: BundleData | null,
  githubData: any,
): PackageMetrics {
  const latestVersion = npmData["dist-tags"]?.latest;
  const versionData = latestVersion ? npmData.versions?.[latestVersion] : null;

  // Calculate download metrics
  let weeklyDownloads = 0;
  let downloadTrend: "growing" | "stable" | "declining" = "stable";
  let downloadVelocity = 0;

  if (downloadData && downloadData.length > 0) {
    // Last 7 days
    weeklyDownloads = downloadData.slice(-7).reduce((sum, d) => sum + (d.downloads || 0), 0);

    // Calculate trend
    const recent = downloadData.slice(-30).reduce((sum, d) => sum + (d.downloads || 0), 0);
    const older = downloadData.slice(0, 30).reduce((sum, d) => sum + (d.downloads || 0), 0);

    if (older > 0) {
      downloadVelocity = Math.round(((recent - older) / older) * 100);
      if (downloadVelocity > 10) downloadTrend = "growing";
      else if (downloadVelocity < -10) downloadTrend = "declining";
    }
  }

  // Days since last commit
  let lastCommitDays = 365;
  if (githubData?.lastCommit) {
    lastCommitDays = Math.floor(
      (Date.now() - new Date(githubData.lastCommit).getTime()) / (1000 * 60 * 60 * 24),
    );
  }

  // Check for types
  const hasTypes = Boolean(
    versionData?.types || versionData?.typings || name.startsWith("@types/"),
  );

  // Check for ESM
  const isESM = Boolean(
    versionData?.type === "module" || versionData?.module || versionData?.exports,
  );

  return {
    name,
    weeklyDownloads,
    downloadTrend,
    downloadVelocity,
    bundleSize: bundleData?.gzip || 0,
    bundleSizeRaw: bundleData?.size || 0,
    treeShakeable: bundleData?.hasJSModule || bundleData?.hasJSNext || false,
    lastCommitDays,
    recentCommits: 0,
    recentReleases: 0,
    stars: githubData?.stars || 0,
    openIssues: githubData?.openIssues || 0,
    contributors: 0,
    hasTypes,
    isESM,
    securityIssues: 0,
    deprecated: Boolean(npmData.deprecated),
    keywords: npmData.keywords || [],
    updatedAt: new Date(),
  };
}
