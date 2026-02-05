/**
 * Package Health Schema
 *
 * Stores real-time health metrics for npm packages
 */

// Re-export GitHubRepoData from the canonical source
export type { GitHubRepoData } from "@packrun/data/github";

export interface PackageHealth {
  /** Package name */
  name: string;

  /** Overall health score (0-100) */
  score: number;

  /** Health status derived from score */
  status: HealthStatus;

  /** Individual health signals */
  signals: HealthSignals;

  /** Recommendation if health is poor */
  recommendation?: string;

  /** Alternative packages to consider */
  alternatives?: string[];

  /** When this health data was last updated */
  updatedAt: Date;
}

export type HealthStatus = "healthy" | "stable" | "maintenance-only" | "at-risk" | "deprecated";

export interface HealthSignals {
  /** Last commit date */
  lastCommit?: Date;
  /** Human-readable last commit (e.g., "3 days ago") */
  lastCommitAgo?: string;

  /** Number of open issues */
  openIssues?: number;
  /** Number of open PRs */
  openPRs?: number;

  /** Download trend: growing, stable, declining */
  downloadTrend?: "growing" | "stable" | "declining";
  /** Weekly downloads */
  weeklyDownloads?: number;
  /** Download change percentage (vs 3 months ago) */
  downloadChange?: number;

  /** Maintainer activity level */
  maintainerActivity?: "high" | "medium" | "low" | "none";
  /** Number of releases in last 6 months */
  recentReleases?: number;

  /** Known security vulnerabilities */
  vulnerabilities?: number;

  /** GitHub stars */
  stars?: number;
  /** Number of contributors */
  contributors?: number;

  /** Is officially deprecated */
  deprecated?: boolean;
  /** Deprecation message */
  deprecatedMessage?: string;
}

/**
 * npm download data for health calculation
 */
export interface NpmDownloadData {
  weeklyDownloads: number;
  monthlyDownloads: number;
  downloadHistory: Array<{ week: string; downloads: number }>;
}

/**
 * Bundlephobia data for bundle size metrics
 */
export interface BundleData {
  /** Gzipped size in bytes */
  gzip: number;
  /** Raw size in bytes */
  size: number;
  /** Number of dependencies */
  dependencyCount: number;
  /** Has ES module export (tree-shakeable) */
  hasJSModule: boolean;
  /** Has jsnext:main field */
  hasJSNext: boolean;
  /** Has sideEffects: false */
  hasSideEffects: boolean;
}

/**
 * Extended package metrics for comparison scoring
 */
export interface PackageMetrics {
  name: string;

  // Downloads
  weeklyDownloads: number;
  downloadTrend: "growing" | "stable" | "declining";
  downloadVelocity: number; // % change over 3 months

  // Bundle
  bundleSize: number; // gzip bytes
  bundleSizeRaw: number; // uncompressed bytes
  treeShakeable: boolean;

  // Maintenance
  lastCommitDays: number;
  recentCommits: number; // last 6 months
  recentReleases: number; // last 6 months

  // Community
  stars: number;
  openIssues: number;
  contributors: number;

  // Quality
  hasTypes: boolean;
  isESM: boolean;
  securityIssues: number;
  deprecated: boolean;

  // Meta
  keywords: string[];
  updatedAt: Date;
}

/**
 * Alternative group discovered by the engine
 */
export interface AlternativeGroup {
  /** Category ID (e.g., "http-client") */
  category: string;
  /** Human-readable name */
  categoryName: string;
  /** Package names in this group */
  packages: string[];
  /** How confident we are this is correct (0-1) */
  confidence: number;
  /** How the group was discovered */
  discoveredVia: "keywords" | "manual";
}

/**
 * Generated comparison with scored packages
 */
export interface GeneratedComparison {
  category: string;
  categoryName: string;

  /** Packages ranked by score */
  packages: ScoredPackage[];

  /** Top-scored package */
  recommendation: string;
  /** Smallest bundle size */
  smallestBundle: string;
  /** Most weekly downloads */
  mostPopular: string;

  /** When this was generated */
  updatedAt: Date;
}

export interface ScoredPackage {
  name: string;
  score: number;
  metrics: PackageMetrics;
  badges: string[];
}

/**
 * Package Comparison Schema
 */

export interface PackageComparison {
  /** Category identifier (e.g., "date-libraries") */
  category: string;

  /** Human-readable category name */
  categoryName: string;

  /** Packages being compared */
  packages: string[];

  /** Recommended package */
  recommendation: string;

  /** Why this package is recommended */
  reasoning: string;

  /** Detailed comparison data */
  comparison: ComparisonData;

  /** When this comparison was last updated */
  updatedAt: Date;
}

export interface ComparisonData {
  /** Bundle size comparison */
  bundleSize?: Record<string, string>;

  /** TypeScript support level */
  typescript?: Record<string, string>;

  /** Maintenance status */
  maintenance?: Record<string, string>;

  /** Tree-shaking support */
  treeShaking?: Record<string, boolean>;

  /** Browser support */
  browser?: Record<string, boolean>;

  /** Node.js support */
  node?: Record<string, boolean>;

  /** ESM support */
  esm?: Record<string, string | boolean>;

  /** Weekly downloads */
  downloads?: Record<string, number>;

  /** Health scores */
  healthScore?: Record<string, number>;

  /** Custom comparison fields */
  [key: string]: Record<string, unknown> | undefined;
}

/**
 * Category definition for comparisons
 */
export interface ComparisonCategory {
  id: string;
  name: string;
  description: string;
  packages: string[];
}
