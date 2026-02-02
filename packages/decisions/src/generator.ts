/**
 * Comparison generator
 *
 * Generates comparisons by fetching metrics and scoring packages.
 */

import { getCategoryName } from "./categories";
import type { AlternativeGroup, GeneratedComparison, PackageMetrics } from "./schema";
import { explainScore, rankPackages } from "./scoring";

/**
 * Generate a comparison for an alternative group
 */
export async function generateComparison(
  group: AlternativeGroup,
  fetchMetrics: (name: string) => Promise<PackageMetrics | null>,
): Promise<GeneratedComparison | null> {
  // Fetch metrics for all packages in parallel
  const metricsPromises = group.packages.map(async (name) => {
    try {
      return await fetchMetrics(name);
    } catch {
      return null;
    }
  });

  const metricsResults = await Promise.all(metricsPromises);

  // Filter out packages we couldn't get metrics for
  const validMetrics = metricsResults.filter((m): m is PackageMetrics => m !== null);

  if (validMetrics.length < 2) {
    return null;
  }

  // Score and rank packages
  const ranked = rankPackages(validMetrics);

  // Find special packages
  const topPackage = ranked[0];
  if (!topPackage) {
    return null;
  }

  const byBundleSize = [...ranked].sort((a, b) => a.metrics.bundleSize - b.metrics.bundleSize);
  const byDownloads = [...ranked].sort(
    (a, b) => b.metrics.weeklyDownloads - a.metrics.weeklyDownloads,
  );

  const recommendation = topPackage.name;
  const smallestBundle = byBundleSize[0]?.name ?? topPackage.name;
  const mostPopular = byDownloads[0]?.name ?? topPackage.name;

  return {
    category: group.category,
    categoryName: group.categoryName || getCategoryName(group.category),
    packages: ranked,
    recommendation,
    smallestBundle,
    mostPopular,
    updatedAt: new Date(),
  };
}

/**
 * Generate a quick comparison for specific packages
 */
export async function compareSpecificPackages(
  packageNames: string[],
  fetchMetrics: (name: string) => Promise<PackageMetrics | null>,
): Promise<GeneratedComparison | null> {
  if (packageNames.length < 2) return null;

  const group: AlternativeGroup = {
    category: "custom",
    categoryName: "Custom Comparison",
    packages: packageNames,
    confidence: 1,
    discoveredVia: "manual",
  };

  return generateComparison(group, fetchMetrics);
}

/**
 * Format comparison as a simple summary
 */
export function formatComparisonSummary(comparison: GeneratedComparison): string {
  const top = comparison.packages[0];
  if (!top) {
    return "No packages to compare.";
  }
  const lines = [
    `Recommended: ${comparison.recommendation} (score: ${top.score}/100)`,
    `Smallest bundle: ${comparison.smallestBundle}`,
    `Most popular: ${comparison.mostPopular}`,
    "",
    "Rankings:",
  ];

  for (const pkg of comparison.packages) {
    const reasons = explainScore(pkg.metrics);
    lines.push(`  ${pkg.score}/100 - ${pkg.name}: ${reasons.slice(0, 2).join(", ")}`);
  }

  return lines.join("\n");
}

/**
 * Get comparison result for API response
 */
export function toApiResponse(comparison: GeneratedComparison) {
  return {
    category: comparison.category,
    categoryName: comparison.categoryName,
    recommendation: comparison.recommendation,
    smallestBundle: comparison.smallestBundle,
    mostPopular: comparison.mostPopular,
    packages: comparison.packages.map((p) => ({
      name: p.name,
      score: p.score,
      badges: p.badges,
      metrics: {
        weeklyDownloads: p.metrics.weeklyDownloads,
        downloadTrend: p.metrics.downloadTrend,
        bundleSize: p.metrics.bundleSize,
        bundleSizeKb: `${(p.metrics.bundleSize / 1000).toFixed(1)}kb`,
        lastCommitDays: p.metrics.lastCommitDays,
        stars: p.metrics.stars,
        hasTypes: p.metrics.hasTypes,
        isESM: p.metrics.isESM,
        deprecated: p.metrics.deprecated,
      },
    })),
    updatedAt: comparison.updatedAt.toISOString(),
  };
}
