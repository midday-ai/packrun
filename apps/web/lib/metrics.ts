/**
 * Package metrics fetcher for comparison engine
 */

import type { BundleData, PackageMetrics } from "@v1/decisions/schema";

const NPM_REGISTRY = "https://registry.npmjs.org";
const NPM_DOWNLOADS = "https://api.npmjs.org/downloads";
const GITHUB_API = "https://api.github.com";
const BUNDLEPHOBIA_API = "https://bundlephobia.com/api/size";

// Simple in-memory cache
const metricsCache = new Map<string, { data: PackageMetrics; timestamp: number }>();
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

/**
 * Fetch complete metrics for a package
 */
export async function fetchPackageMetrics(packageName: string): Promise<PackageMetrics | null> {
  // Check cache
  const cached = metricsCache.get(packageName);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  try {
    // Fetch all data in parallel
    const [npmData, downloadData, bundleData] = await Promise.all([
      fetchNpmData(packageName),
      fetchDownloadData(packageName),
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

    // Cache
    metricsCache.set(packageName, { data: metrics, timestamp: Date.now() });

    return metrics;
  } catch (error) {
    console.error(`Error fetching metrics for ${packageName}:`, error);
    return null;
  }
}

/**
 * Fetch npm registry data
 */
async function fetchNpmData(packageName: string) {
  const res = await fetch(`${NPM_REGISTRY}/${encodeURIComponent(packageName)}`, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) return null;
  return res.json();
}

/**
 * Fetch download history
 */
async function fetchDownloadData(packageName: string) {
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
 * Parse GitHub URL to owner/repo
 */
function parseGitHubUrl(url: string): { owner: string; repo: string } | null {
  const match = url.match(/github\.com\/([^/]+)\/([^/#?]+)/);
  if (!match) return null;
  return { owner: match[1], repo: match[2].replace(/\.git$/, "") };
}

/**
 * Fetch GitHub data
 */
async function fetchGitHubData(repoUrl: string) {
  const parsed = parseGitHubUrl(repoUrl);
  if (!parsed) return null;

  const headers: Record<string, string> = {
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "v1.run",
  };
  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `token ${process.env.GITHUB_TOKEN}`;
  }

  try {
    const res = await fetch(`${GITHUB_API}/repos/${parsed.owner}/${parsed.repo}`, { headers });
    if (!res.ok) return null;

    const data = await res.json();

    // Get recent commits count
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const commitsRes = await fetch(
      `${GITHUB_API}/repos/${parsed.owner}/${parsed.repo}/commits?since=${sixMonthsAgo.toISOString()}&per_page=100`,
      { headers },
    );
    const commits = commitsRes.ok ? await commitsRes.json() : [];

    return {
      stars: data.stargazers_count || 0,
      openIssues: data.open_issues_count || 0,
      lastCommit: new Date(data.pushed_at),
      contributors: 0, // Skip for simplicity
      recentCommits: Array.isArray(commits) ? commits.length : 0,
    };
  } catch {
    return null;
  }
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
    recentCommits: githubData?.recentCommits || 0,
    recentReleases: 0, // Skip for now
    stars: githubData?.stars || 0,
    openIssues: githubData?.openIssues || 0,
    contributors: githubData?.contributors || 0,
    hasTypes,
    isESM,
    securityIssues: 0, // Would need npm audit API
    deprecated: Boolean(npmData.deprecated),
    keywords: npmData.keywords || [],
    updatedAt: new Date(),
  };
}

/**
 * Batch fetch metrics with rate limiting
 */
export async function fetchMetricsBatch(
  packageNames: string[],
  concurrency = 3,
): Promise<Map<string, PackageMetrics>> {
  const results = new Map<string, PackageMetrics>();

  for (let i = 0; i < packageNames.length; i += concurrency) {
    const batch = packageNames.slice(i, i + concurrency);
    const promises = batch.map(async (name) => {
      const metrics = await fetchPackageMetrics(name);
      if (metrics) {
        results.set(name, metrics);
      }
    });

    await Promise.all(promises);

    // Small delay between batches
    if (i + concurrency < packageNames.length) {
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }

  return results;
}
