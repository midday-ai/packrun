/**
 * Health data fetching for API routes
 */

import { getAlternatives } from "@v1/decisions/comparisons";
import { buildHealthSignals, buildPackageHealth } from "@v1/decisions/health";
import type { GitHubRepoData, NpmDownloadData, PackageHealth } from "@v1/decisions/schema";

const GITHUB_API = "https://api.github.com";
const NPM_DOWNLOADS_API = "https://api.npmjs.org/downloads";
const NPM_REGISTRY = "https://registry.npmjs.org";

// Simple in-memory cache for API routes
const healthCache = new Map<string, { data: PackageHealth; timestamp: number }>();
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

/**
 * Parse GitHub URL to owner/repo
 */
function parseGitHubUrl(url: string): { owner: string; repo: string } | null {
  const match = url.match(/github\.com\/([^/]+)\/([^/#?]+)/);
  if (match) {
    return { owner: match[1], repo: match[2].replace(/\.git$/, "") };
  }
  return null;
}

/**
 * Extract GitHub URL from repository field
 */
function extractGitHubUrl(repository: string | { url?: string } | undefined): string | null {
  if (!repository) return null;
  const url = typeof repository === "string" ? repository : repository.url;
  if (!url) return null;
  const cleaned = url.replace(/^git\+/, "").replace(/\.git$/, "");
  return cleaned.includes("github.com") ? cleaned : null;
}

/**
 * Fetch GitHub repo data
 */
async function fetchGitHubData(owner: string, repo: string): Promise<GitHubRepoData | null> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "v1.run",
  };

  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `token ${process.env.GITHUB_TOKEN}`;
  }

  try {
    const repoRes = await fetch(`${GITHUB_API}/repos/${owner}/${repo}`, {
      headers,
      next: { revalidate: 3600 }, // Cache for 1 hour
    });
    if (!repoRes.ok) return null;

    const repoData = await repoRes.json();

    // Get recent commits
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const [commitsRes, releasesRes] = await Promise.all([
      fetch(
        `${GITHUB_API}/repos/${owner}/${repo}/commits?since=${sixMonthsAgo.toISOString()}&per_page=100`,
        { headers },
      ),
      fetch(`${GITHUB_API}/repos/${owner}/${repo}/releases?per_page=10`, { headers }),
    ]);

    const commits = commitsRes.ok ? await commitsRes.json() : [];
    const releases = releasesRes.ok ? await releasesRes.json() : [];
    const recentReleases = releases.filter(
      (r: any) => new Date(r.published_at) > sixMonthsAgo,
    ).length;

    return {
      owner,
      repo,
      stars: repoData.stargazers_count,
      forks: repoData.forks_count,
      openIssues: repoData.open_issues_count,
      openPRs: 0, // Simplified
      lastCommit: new Date(repoData.pushed_at),
      contributors: 0, // Simplified
      recentCommits: Array.isArray(commits) ? commits.length : 0,
      recentReleases,
    };
  } catch {
    return null;
  }
}

/**
 * Fetch npm download history
 */
async function fetchNpmDownloads(packageName: string): Promise<NpmDownloadData | null> {
  try {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 90);

    const formatDate = (d: Date) => d.toISOString().split("T")[0];

    const response = await fetch(
      `${NPM_DOWNLOADS_API}/range/${formatDate(startDate)}:${formatDate(endDate)}/${encodeURIComponent(packageName)}`,
      { next: { revalidate: 3600 } },
    );

    if (!response.ok) return null;

    const data = await response.json();

    // Aggregate into weekly buckets
    const weeklyData: Record<string, number> = {};
    for (const point of data.downloads || []) {
      const date = new Date(point.day);
      const week = `${date.getFullYear()}-W${String(Math.ceil((date.getDate() + new Date(date.getFullYear(), 0, 1).getDay()) / 7)).padStart(2, "0")}`;
      weeklyData[week] = (weeklyData[week] || 0) + point.downloads;
    }

    const downloadHistory = Object.entries(weeklyData)
      .map(([week, downloads]) => ({ week, downloads }))
      .sort((a, b) => a.week.localeCompare(b.week));

    const weeklyDownloads =
      downloadHistory.length > 0 ? downloadHistory[downloadHistory.length - 1].downloads : 0;
    const monthlyDownloads = downloadHistory.slice(-4).reduce((sum, w) => sum + w.downloads, 0);

    return { weeklyDownloads, monthlyDownloads, downloadHistory };
  } catch {
    return null;
  }
}

/**
 * Fetch package health
 */
export async function fetchPackageHealth(packageName: string): Promise<PackageHealth | null> {
  // Check cache
  const cached = healthCache.get(packageName);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  try {
    // Fetch npm metadata
    const npmRes = await fetch(`${NPM_REGISTRY}/${encodeURIComponent(packageName)}`, {
      next: { revalidate: 3600 },
    });
    if (!npmRes.ok) return null;

    const npmData = await npmRes.json();

    // Fetch GitHub and download data in parallel
    let githubData: GitHubRepoData | null = null;
    const githubUrl = extractGitHubUrl(npmData.repository);
    if (githubUrl) {
      const parsed = parseGitHubUrl(githubUrl);
      if (parsed) {
        githubData = await fetchGitHubData(parsed.owner, parsed.repo);
      }
    }

    const downloadData = await fetchNpmDownloads(packageName);

    // Build health
    const signals = buildHealthSignals(
      githubData,
      downloadData,
      Boolean(npmData.deprecated),
      typeof npmData.deprecated === "string" ? npmData.deprecated : undefined,
    );

    const alternativesData = getAlternatives(packageName);
    const health = buildPackageHealth(packageName, signals, alternativesData?.alternatives);

    // Cache
    healthCache.set(packageName, { data: health, timestamp: Date.now() });

    return health;
  } catch (error) {
    console.error(`Error fetching health for ${packageName}:`, error);
    return null;
  }
}
