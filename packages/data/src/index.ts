/**
 * @v1/data - Shared data fetching clients for external services
 *
 * Usage:
 *   import { fetchPackageMetadata } from "@v1/data/npm";
 *   import { fetchGitHubRepoData } from "@v1/data/github";
 *   import { fetchVulnerabilities } from "@v1/data/osv";
 *   import { fetchNpmsScores } from "@v1/data/npms";
 *   import { fetchBundleData } from "@v1/data/bundlephobia";
 *
 * Or import all:
 *   import * as npm from "@v1/data/npm";
 */

export * from "./bundlephobia";
export * from "./github";
// Re-export all clients
export * from "./npm";
export * from "./npms";
export * from "./osv";
