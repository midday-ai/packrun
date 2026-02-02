/**
 * Health score calculation utilities
 */

import type {
  GitHubRepoData,
  HealthSignals,
  HealthStatus,
  NpmDownloadData,
  PackageHealth,
} from "./schema";

/**
 * Calculate health score from signals
 *
 * Weights:
 * - maintainer_activity: 30%
 * - issue_responsiveness: 20%
 * - download_trend: 20%
 * - security: 15%
 * - community: 15%
 */
export function calculateHealthScore(signals: HealthSignals): number {
  let score = 0;
  let weights = 0;

  // Maintainer activity (30%)
  if (signals.maintainerActivity !== undefined) {
    const activityScores = { high: 100, medium: 70, low: 40, none: 10 };
    score += activityScores[signals.maintainerActivity] * 0.3;
    weights += 0.3;
  }

  // Recent releases as proxy for issue responsiveness (20%)
  if (signals.recentReleases !== undefined) {
    const releaseScore = Math.min(signals.recentReleases * 15, 100);
    score += releaseScore * 0.2;
    weights += 0.2;
  }

  // Download trend (20%)
  if (signals.downloadTrend !== undefined) {
    const trendScores = { growing: 100, stable: 70, declining: 30 };
    score += trendScores[signals.downloadTrend] * 0.2;
    weights += 0.2;
  }

  // Security (15%)
  if (signals.vulnerabilities !== undefined) {
    const securityScore =
      signals.vulnerabilities === 0 ? 100 : Math.max(0, 100 - signals.vulnerabilities * 25);
    score += securityScore * 0.15;
    weights += 0.15;
  }

  // Community (15%)
  if (signals.stars !== undefined || signals.contributors !== undefined) {
    let communityScore = 50;
    if (signals.stars !== undefined) {
      communityScore = Math.min(signals.stars / 100, 100);
    }
    if (signals.contributors !== undefined) {
      communityScore = Math.max(communityScore, Math.min(signals.contributors * 5, 100));
    }
    score += communityScore * 0.15;
    weights += 0.15;
  }

  // Deprecated packages get a severe penalty
  if (signals.deprecated) {
    return Math.min(score / weights, 25);
  }

  // Normalize by actual weights used
  return weights > 0 ? Math.round(score / weights) : 50;
}

/**
 * Get health status from score
 */
export function getHealthStatus(score: number, deprecated?: boolean): HealthStatus {
  if (deprecated) return "deprecated";
  if (score >= 80) return "healthy";
  if (score >= 60) return "stable";
  if (score >= 40) return "maintenance-only";
  return "at-risk";
}

/**
 * Calculate maintainer activity from GitHub data
 */
export function getMaintainerActivity(
  recentCommits: number,
  recentReleases: number,
): HealthSignals["maintainerActivity"] {
  const total = recentCommits + recentReleases * 5;
  if (total >= 50) return "high";
  if (total >= 20) return "medium";
  if (total >= 5) return "low";
  return "none";
}

/**
 * Calculate download trend from history
 */
export function getDownloadTrend(
  history: NpmDownloadData["downloadHistory"],
): HealthSignals["downloadTrend"] {
  if (history.length < 4) return "stable";

  const recent = history.slice(-4).reduce((sum, w) => sum + w.downloads, 0) / 4;
  const older = history.slice(-12, -4).reduce((sum, w) => sum + w.downloads, 0) / 8;

  if (older === 0) return "stable";

  const change = (recent - older) / older;
  if (change > 0.1) return "growing";
  if (change < -0.1) return "declining";
  return "stable";
}

/**
 * Format relative time (e.g., "3 days ago")
 */
export function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "today";
  if (diffDays === 1) return "yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
  return `${Math.floor(diffDays / 365)} years ago`;
}

/**
 * Build health signals from raw data
 */
export function buildHealthSignals(
  github: GitHubRepoData | null,
  npm: NpmDownloadData | null,
  deprecated?: boolean,
  deprecatedMessage?: string,
): HealthSignals {
  const signals: HealthSignals = {};

  if (github) {
    signals.lastCommit = github.lastCommit;
    signals.lastCommitAgo = formatTimeAgo(github.lastCommit);
    signals.openIssues = github.openIssues;
    signals.openPRs = github.openPRs;
    signals.stars = github.stars;
    signals.contributors = github.contributors;
    signals.recentReleases = github.recentReleases;
    signals.maintainerActivity = getMaintainerActivity(github.recentCommits, github.recentReleases);
  }

  if (npm) {
    signals.weeklyDownloads = npm.weeklyDownloads;
    signals.downloadTrend = getDownloadTrend(npm.downloadHistory);

    // Calculate download change
    if (npm.downloadHistory.length >= 12) {
      const recent = npm.downloadHistory.slice(-4).reduce((sum, w) => sum + w.downloads, 0) / 4;
      const older = npm.downloadHistory.slice(-12, -4).reduce((sum, w) => sum + w.downloads, 0) / 8;
      if (older > 0) {
        signals.downloadChange = Math.round(((recent - older) / older) * 100);
      }
    }
  }

  if (deprecated !== undefined) {
    signals.deprecated = deprecated;
    signals.deprecatedMessage = deprecatedMessage;
  }

  return signals;
}

/**
 * Build complete health object
 */
export function buildPackageHealth(
  name: string,
  signals: HealthSignals,
  alternatives?: string[],
): PackageHealth {
  const score = calculateHealthScore(signals);
  const status = getHealthStatus(score, signals.deprecated);

  let recommendation: string | undefined;
  if (status === "deprecated" && alternatives?.length) {
    recommendation = `Deprecated. Consider ${alternatives.slice(0, 2).join(" or ")} instead`;
  } else if (status === "at-risk" && alternatives?.length) {
    recommendation = `Low maintenance. Consider ${alternatives.slice(0, 2).join(" or ")} as alternatives`;
  } else if (status === "maintenance-only") {
    recommendation = "In maintenance mode - may not receive new features";
  }

  return {
    name,
    score,
    status,
    signals,
    recommendation,
    alternatives: status !== "healthy" && status !== "stable" ? alternatives : undefined,
    updatedAt: new Date(),
  };
}
