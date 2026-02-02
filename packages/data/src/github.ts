/**
 * GitHub API Client
 *
 * Fetches repository data from GitHub.
 * Note: Unauthenticated requests are limited to 60/hour.
 */

const GITHUB_API = "https://api.github.com";
const UNGH_API = "https://ungh.cc"; // Unauthenticated proxy

/**
 * GitHub repository data
 */
export interface GitHubRepoData {
  owner: string;
  repo: string;
  stars: number;
  forks: number;
  openIssues: number;
  openPRs: number;
  lastCommit: Date;
  pushedAt: string;
  contributors: number;
  recentCommits: number;
  recentReleases: number;
  isArchived: boolean;
  topics: string[];
  language: string | null;
}

interface GitHubRepoResponse {
  stargazers_count: number;
  forks_count: number;
  open_issues_count: number;
  pushed_at: string;
  archived: boolean;
  topics?: string[];
  language: string | null;
}

/**
 * Parse GitHub repository URL to owner/repo
 */
export function parseGitHubUrl(url: string): { owner: string; repo: string } | null {
  const patterns = [/github\.com\/([^/]+)\/([^/#?]+)/, /github\.com:([^/]+)\/([^/.]+)/];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1] && match[2]) {
      return {
        owner: match[1],
        repo: match[2].replace(/\.git$/, ""),
      };
    }
  }

  return null;
}

/**
 * Extract GitHub URL from npm repository field
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
 * Fetch full repository data from GitHub API
 * Requires multiple API calls, best for detailed health assessments
 */
export async function fetchGitHubRepoData(
  owner: string,
  repo: string,
  token?: string,
): Promise<GitHubRepoData | null> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "v1.run",
  };

  if (token) {
    headers.Authorization = `token ${token}`;
  }

  try {
    const repoResponse = await fetch(`${GITHUB_API}/repos/${owner}/${repo}`, { headers });
    if (!repoResponse.ok) {
      console.error(`[GitHub] API error for ${owner}/${repo}: ${repoResponse.status}`);
      return null;
    }
    const repoData: GitHubRepoResponse = await repoResponse.json();

    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    // Fetch additional data in parallel
    const [commitsRes, releasesRes, contributorsRes, prsRes] = await Promise.all([
      fetch(
        `${GITHUB_API}/repos/${owner}/${repo}/commits?since=${sixMonthsAgo.toISOString()}&per_page=100`,
        { headers },
      ),
      fetch(`${GITHUB_API}/repos/${owner}/${repo}/releases?per_page=20`, { headers }),
      fetch(`${GITHUB_API}/repos/${owner}/${repo}/contributors?per_page=1`, { headers }),
      fetch(`${GITHUB_API}/repos/${owner}/${repo}/pulls?state=open&per_page=1`, { headers }),
    ]);

    const commits = commitsRes.ok ? await commitsRes.json() : [];
    const releases = releasesRes.ok ? await releasesRes.json() : [];
    const recentReleases = releases.filter(
      (r: { published_at: string }) => new Date(r.published_at) > sixMonthsAgo,
    ).length;

    // Get contributor count from pagination
    let contributorCount = 0;
    if (contributorsRes.ok) {
      const linkHeader = contributorsRes.headers.get("Link");
      if (linkHeader) {
        const lastMatch = linkHeader.match(/page=(\d+)>; rel="last"/);
        contributorCount = lastMatch?.[1] ? Number.parseInt(lastMatch[1]) : 1;
      } else {
        const contributors = await contributorsRes.json();
        contributorCount = contributors.length;
      }
    }

    // Get open PR count from pagination
    let openPRs = 0;
    if (prsRes.ok) {
      const linkHeader = prsRes.headers.get("Link");
      if (linkHeader) {
        const lastMatch = linkHeader.match(/page=(\d+)>; rel="last"/);
        openPRs = lastMatch?.[1] ? Number.parseInt(lastMatch[1]) : 1;
      } else {
        openPRs = ((await prsRes.json()) as unknown[]).length;
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
      pushedAt: repoData.pushed_at,
      contributors: contributorCount,
      recentCommits: Array.isArray(commits) ? commits.length : 0,
      recentReleases,
      isArchived: repoData.archived,
      topics: repoData.topics || [],
      language: repoData.language,
    };
  } catch (error) {
    console.error(`[GitHub] Error fetching data for ${owner}/${repo}:`, error);
    return null;
  }
}

/**
 * Fetch basic repository data (stars only) using ungh.cc proxy
 * No auth required, good for batch operations
 */
export async function fetchGitHubStars(owner: string, repo: string): Promise<number | undefined> {
  try {
    const response = await fetch(`${UNGH_API}/repos/${owner}/${repo}`, {
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

/**
 * Fetch basic repository data from GitHub API (single call)
 * Good for quick lookups without full health data
 */
export async function fetchGitHubRepoBasic(
  owner: string,
  repo: string,
): Promise<Pick<
  GitHubRepoData,
  "stars" | "forks" | "openIssues" | "pushedAt" | "isArchived" | "topics" | "language"
> | null> {
  try {
    const response = await fetch(`${GITHUB_API}/repos/${owner}/${repo}`, {
      headers: {
        Accept: "application/vnd.github.v3+json",
        "User-Agent": "v1.run",
      },
    });

    if (!response.ok) {
      return null;
    }

    const data: GitHubRepoResponse = await response.json();

    return {
      stars: data.stargazers_count,
      forks: data.forks_count,
      openIssues: data.open_issues_count,
      pushedAt: data.pushed_at,
      isArchived: data.archived,
      topics: data.topics || [],
      language: data.language,
    };
  } catch (error) {
    console.error(`[GitHub] Error fetching basic data for ${owner}/${repo}:`, error);
    return null;
  }
}
