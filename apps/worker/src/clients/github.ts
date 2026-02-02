/**
 * GitHub API Client for Worker
 *
 * Re-exports from @v1/data/github with worker-specific additions.
 */

// Re-export everything from shared package
export {
  extractGitHubUrl,
  fetchGitHubRepoBasic,
  fetchGitHubRepoData,
  fetchGitHubStars,
  fetchGitHubStarsBatch,
  type GitHubRepoData,
  parseGitHubUrl,
} from "@v1/data/github";
