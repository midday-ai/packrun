/**
 * @packrun/data - Shared data fetching clients for external services
 *
 * Usage:
 *   import { fetchPackageMetadata } from "@packrun/data/npm";
 *   import { fetchGitHubRepoData } from "@packrun/data/github";
 *   import { fetchVulnerabilities } from "@packrun/data/osv";
 *   import { fetchNpmsScores } from "@packrun/data/npms";
 *   import { fetchBundleData } from "@packrun/data/bundlephobia";
 *
 * Or import all:
 *   import * as npm from "@packrun/data/npm";
 */

export * from "./bundlephobia";
export * from "./github";
// Re-export all clients
export * from "./npm";
export * from "./npms";
export * from "./osv";
