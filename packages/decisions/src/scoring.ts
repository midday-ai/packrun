/**
 * Package scoring formula for comparison ranking
 */

import type { PackageMetrics, ScoredPackage } from "./schema";

/**
 * Calculate a package's score (0-100)
 *
 * Weights:
 * - Popularity (downloads): 20%
 * - Bundle size (smaller = better): 20%
 * - Freshness (recent commits): 25%
 * - Community (stars): 10%
 * - Trend bonus/penalty: +10/-15
 * - Security penalty: -20
 * - TypeScript bonus: +10
 * - ESM bonus: +5
 */
export function scorePackage(m: PackageMetrics): number {
  // Deprecated packages get 0
  if (m.deprecated) return 0;

  // Normalize each metric to 0-1 scale
  const popularity = normalize(m.weeklyDownloads, 0, 50_000_000);
  const size = 1 - normalize(m.bundleSize, 0, 200_000); // Smaller = better, max 200kb
  const freshness = 1 - normalize(m.lastCommitDays, 0, 365); // Recent = better
  const community = normalize(m.stars, 0, 50_000);
  const activity = normalize(m.recentCommits + m.recentReleases * 5, 0, 100);

  // Base score from weighted metrics
  let score = popularity * 0.15 + size * 0.2 + freshness * 0.2 + community * 0.1 + activity * 0.1;

  // Trend bonus/penalty
  if (m.downloadTrend === "growing") {
    score += 0.08;
  } else if (m.downloadTrend === "declining") {
    score -= 0.12;
  }

  // Security penalty
  if (m.securityIssues > 0) {
    score -= 0.15;
  }

  // Quality bonuses
  if (m.hasTypes) score += 0.08;
  if (m.isESM) score += 0.04;
  if (m.treeShakeable) score += 0.05;

  // Normalize to 0-100
  return Math.round(Math.max(0, Math.min(1, score)) * 100);
}

/**
 * Normalize a value to 0-1 range
 */
function normalize(value: number, min: number, max: number): number {
  if (max === min) return 0.5;
  return Math.max(0, Math.min(1, (value - min) / (max - min)));
}

/**
 * Generate badges for a package based on its metrics
 */
export function generateBadges(m: PackageMetrics): string[] {
  const badges: string[] = [];

  if (m.deprecated) {
    badges.push("Deprecated");
    return badges;
  }

  if (m.hasTypes) badges.push("TypeScript");
  if (m.isESM) badges.push("ESM");
  if (m.treeShakeable) badges.push("Tree-shakeable");

  if (m.downloadTrend === "growing") badges.push("Trending Up");
  if (m.downloadTrend === "declining") badges.push("Declining");

  if (m.bundleSize < 5000) badges.push("Tiny (<5kb)");
  else if (m.bundleSize < 15000) badges.push("Small (<15kb)");
  else if (m.bundleSize > 100000) badges.push("Large (>100kb)");

  if (m.securityIssues > 0) badges.push("Security Issues");

  if (m.lastCommitDays > 180) badges.push("Inactive");
  else if (m.lastCommitDays < 14) badges.push("Active");

  if (m.weeklyDownloads > 10_000_000) badges.push("Very Popular");

  return badges;
}

/**
 * Score and rank packages
 */
export function rankPackages(packages: PackageMetrics[]): ScoredPackage[] {
  return packages
    .map((metrics) => ({
      name: metrics.name,
      score: scorePackage(metrics),
      metrics,
      badges: generateBadges(metrics),
    }))
    .sort((a, b) => b.score - a.score);
}

/**
 * Get explanation for why a package scored the way it did
 */
export function explainScore(m: PackageMetrics): string[] {
  const reasons: string[] = [];

  if (m.deprecated) {
    return ["Package is deprecated"];
  }

  // Positive reasons
  if (m.downloadTrend === "growing") {
    reasons.push("Downloads growing");
  }
  if (m.hasTypes) {
    reasons.push("TypeScript types included");
  }
  if (m.bundleSize < 15000) {
    reasons.push(`Small bundle (${(m.bundleSize / 1000).toFixed(1)}kb)`);
  }
  if (m.lastCommitDays < 30) {
    reasons.push("Actively maintained");
  }
  if (m.stars > 10000) {
    reasons.push(`Popular (${(m.stars / 1000).toFixed(0)}k stars)`);
  }

  // Negative reasons
  if (m.downloadTrend === "declining") {
    reasons.push("Downloads declining");
  }
  if (m.securityIssues > 0) {
    reasons.push(`${m.securityIssues} security issue(s)`);
  }
  if (m.lastCommitDays > 180) {
    reasons.push("No recent commits");
  }
  if (m.bundleSize > 100000) {
    reasons.push(`Large bundle (${(m.bundleSize / 1000).toFixed(0)}kb)`);
  }

  return reasons;
}
