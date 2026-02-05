/**
 * GitHub API Client for API Server
 *
 * Uses @packrun/data/github. No caching - Cloudflare caches final API responses.
 */

import { fetchGitHubRepoBasic, parseGitHubUrl } from "@packrun/data/github";

// Get GitHub token from environment (optional - increases rate limit from 60/hour to 5000/hour)
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

// Re-export types and utilities
export { fetchGitHubReadme, type GitHubRepoData, parseGitHubUrl } from "@packrun/data/github";

/**
 * Simplified GitHub data for API responses
 */
export interface GitHubData {
  stars: number;
  forks: number;
  openIssues: number;
  lastCommit: string;
  pushedAt: string;
  isArchived: boolean;
  topics: string[];
  language: string | null;
}

/**
 * Fetch repository data from GitHub
 * No caching - Cloudflare caches final API responses
 */
export async function fetchGitHubData(repositoryUrl: string): Promise<GitHubData | null> {
  const parsed = parseGitHubUrl(repositoryUrl);
  if (!parsed) return null;

  const { owner, repo } = parsed;

  // Fetch from shared client (with token if available)
  const data = await fetchGitHubRepoBasic(owner, repo, GITHUB_TOKEN);
  if (!data) return null;

  return {
    stars: data.stars,
    forks: data.forks,
    openIssues: data.openIssues,
    lastCommit: data.pushedAt,
    pushedAt: data.pushedAt,
    isArchived: data.isArchived,
    topics: data.topics,
    language: data.language,
  };
}

/**
 * Fetch GitHub data for a package by name
 * No caching - Cloudflare caches final API responses
 */
export async function fetchGitHubDataForPackage(
  packageName: string,
  repositoryUrl?: string,
): Promise<GitHubData | null> {
  if (!repositoryUrl) return null;
  return fetchGitHubData(repositoryUrl);
}
