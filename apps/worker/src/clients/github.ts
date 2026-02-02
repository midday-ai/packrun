/**
 * GitHub API Client
 *
 * Fetches repository health data from GitHub.
 */

import type { GitHubRepoData } from "@v1/decisions/schema";

const GITHUB_API = "https://api.github.com";

interface GitHubRepo {
  stargazers_count: number;
  forks_count: number;
  open_issues_count: number;
  pushed_at: string;
}

interface GitHubCommit {
  sha: string;
  commit: { author: { date: string } };
}

interface GitHubRelease {
  tag_name: string;
  published_at: string;
}

interface GitHubContributor {
  login: string;
}

/**
 * Parse GitHub repository URL to owner/repo
 */
export function parseGitHubUrl(url: string): { owner: string; repo: string } | null {
  const patterns = [/github\.com\/([^/]+)\/([^/#?]+)/, /github\.com:([^/]+)\/([^/.]+)/];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      return {
        owner: match[1],
        repo: match[2].replace(/\.git$/, ""),
      };
    }
  }

  return null;
}

/**
 * Fetch repository data from GitHub
 */
export async function fetchGitHubRepoData(
  owner: string,
  repo: string,
  token?: string,
): Promise<GitHubRepoData | null> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "v1.run-health-worker",
  };

  if (token) {
    headers.Authorization = `token ${token}`;
  }

  try {
    const repoResponse = await fetch(`${GITHUB_API}/repos/${owner}/${repo}`, { headers });
    if (!repoResponse.ok) {
      console.error(`GitHub API error for ${owner}/${repo}: ${repoResponse.status}`);
      return null;
    }
    const repoData: GitHubRepo = await repoResponse.json();

    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const commitsResponse = await fetch(
      `${GITHUB_API}/repos/${owner}/${repo}/commits?since=${sixMonthsAgo.toISOString()}&per_page=100`,
      { headers },
    );
    const commits: GitHubCommit[] = commitsResponse.ok ? await commitsResponse.json() : [];

    const releasesResponse = await fetch(
      `${GITHUB_API}/repos/${owner}/${repo}/releases?per_page=20`,
      { headers },
    );
    const releases: GitHubRelease[] = releasesResponse.ok ? await releasesResponse.json() : [];
    const recentReleases = releases.filter((r) => new Date(r.published_at) > sixMonthsAgo).length;

    const contributorsResponse = await fetch(
      `${GITHUB_API}/repos/${owner}/${repo}/contributors?per_page=1`,
      { headers },
    );
    let contributorCount = 0;
    if (contributorsResponse.ok) {
      const linkHeader = contributorsResponse.headers.get("Link");
      if (linkHeader) {
        const lastMatch = linkHeader.match(/page=(\d+)>; rel="last"/);
        contributorCount = lastMatch ? Number.parseInt(lastMatch[1]) : 1;
      } else {
        const contributors: GitHubContributor[] = await contributorsResponse.json();
        contributorCount = contributors.length;
      }
    }

    const prsResponse = await fetch(
      `${GITHUB_API}/repos/${owner}/${repo}/pulls?state=open&per_page=1`,
      { headers },
    );
    let openPRs = 0;
    if (prsResponse.ok) {
      const linkHeader = prsResponse.headers.get("Link");
      if (linkHeader) {
        const lastMatch = linkHeader.match(/page=(\d+)>; rel="last"/);
        openPRs = lastMatch ? Number.parseInt(lastMatch[1]) : 1;
      } else {
        openPRs = ((await prsResponse.json()) as unknown[]).length;
      }
    }

    return {
      owner,
      repo,
      stars: repoData.stargazers_count,
      forks: repoData.forks_count,
      openIssues: repoData.open_issues_count - openPRs,
      openPRs,
      lastCommit: new Date(repoData.pushed_at),
      contributors: contributorCount,
      recentCommits: commits.length,
      recentReleases,
    };
  } catch (error) {
    console.error(`Error fetching GitHub data for ${owner}/${repo}:`, error);
    return null;
  }
}

/**
 * Extract GitHub URL from npm package metadata
 */
export function extractGitHubUrl(
  repository: string | { url?: string; type?: string } | undefined,
): string | null {
  if (!repository) return null;

  let url: string;
  if (typeof repository === "string") {
    url = repository;
  } else if (repository.url) {
    url = repository.url;
  } else {
    return null;
  }

  url = url.replace(/^git\+/, "").replace(/\.git$/, "");

  if (url.includes("github.com")) {
    return url;
  }

  return null;
}

/**
 * Fetch GitHub stars using ungh.cc proxy (no auth required)
 */
export async function fetchGitHubStars(owner: string, repo: string): Promise<number | undefined> {
  try {
    const response = await fetch(`https://ungh.cc/repos/${owner}/${repo}`, {
      headers: { "User-Agent": "v1.run" },
    });

    if (!response.ok) {
      return undefined;
    }

    const data = (await response.json()) as { repo?: { stars?: number } };
    return data.repo?.stars;
  } catch {
    return undefined;
  }
}

/**
 * Batch fetch GitHub stars for multiple repositories
 */
export async function fetchGitHubStarsBatch(
  repos: Array<{ owner: string; repo: string; packageName: string }>,
): Promise<Map<string, number>> {
  const results = new Map<string, number>();
  const batchSize = 10;

  for (let i = 0; i < repos.length; i += batchSize) {
    const batch = repos.slice(i, i + batchSize);
    const promises = batch.map(async ({ owner, repo, packageName }) => {
      const stars = await fetchGitHubStars(owner, repo);
      if (stars !== undefined) {
        results.set(packageName, stars);
      }
    });
    await Promise.all(promises);
  }

  return results;
}
