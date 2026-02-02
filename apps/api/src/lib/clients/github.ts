/**
 * GitHub API Client for API Server
 *
 * Uses @v1/data/github with Redis caching layer.
 */

import { fetchGitHubRepoBasic, parseGitHubUrl } from "@v1/data/github";
import { CacheKey, cache, TTL } from "../redis";

// Re-export types and utilities
export { type GitHubRepoData, parseGitHubUrl } from "@v1/data/github";

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
 * Fetch repository data from GitHub with caching
 */
export async function fetchGitHubData(repositoryUrl: string): Promise<GitHubData | null> {
  const parsed = parseGitHubUrl(repositoryUrl);
  if (!parsed) return null;

  const { owner, repo } = parsed;
  const cacheKey = CacheKey.github(`${owner}/${repo}`);

  // Check cache first
  const cached = await cache.get<GitHubData>(cacheKey);
  if (cached) return cached;

  // Fetch from shared client
  const data = await fetchGitHubRepoBasic(owner, repo);
  if (!data) return null;

  const result: GitHubData = {
    stars: data.stars,
    forks: data.forks,
    openIssues: data.openIssues,
    lastCommit: data.pushedAt,
    pushedAt: data.pushedAt,
    isArchived: data.isArchived,
    topics: data.topics,
    language: data.language,
  };

  // Cache for 1 day
  await cache.set(cacheKey, result, TTL.GITHUB);

  return result;
}

/**
 * Fetch GitHub data for a package by name
 */
export async function fetchGitHubDataForPackage(
  packageName: string,
  repositoryUrl?: string,
): Promise<GitHubData | null> {
  const cacheKey = CacheKey.github(packageName);

  // Check package-level cache first
  const cached = await cache.get<GitHubData>(cacheKey);
  if (cached) return cached;

  if (!repositoryUrl) return null;

  const data = await fetchGitHubData(repositoryUrl);

  if (data) {
    // Also cache by package name for quick lookups
    await cache.set(cacheKey, data, TTL.GITHUB);
  }

  return data;
}
