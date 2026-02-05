/**
 * suggest_latest_for_category - Get latest versions of top packages in a category
 *
 * Returns the latest versions of the best packages in a category,
 * with health scores and recommendations.
 */

import { getCategoryName } from "@packrun/decisions/categories";
import {
  COMPARISON_CATEGORIES,
  getComparison as getCuratedComparison,
} from "@packrun/decisions/comparisons";
import { z } from "zod";
import { getLatestWithHealth } from "./latest-health";

export const suggestLatestForCategorySchema = z.object({
  category: z.string().describe("Category ID (e.g., 'http-client', 'date-library', 'validation')"),
  limit: z
    .number()
    .min(1)
    .max(10)
    .optional()
    .default(5)
    .describe("Number of packages to return (1-10)"),
  minHealthScore: z
    .number()
    .min(0)
    .max(100)
    .optional()
    .default(60)
    .describe("Minimum health score (0-100)"),
});

export type SuggestLatestForCategoryInput = z.infer<typeof suggestLatestForCategorySchema>;

export interface CategoryPackage {
  name: string;
  latestVersion: string;
  healthScore: number;
  weeklyDownloads: number;
  vulnerabilities: number;
  isSafeToUse: boolean;
  whyRecommended: string[];
}

export interface SuggestLatestForCategoryResult {
  category: {
    id: string;
    name: string;
  };
  packages: CategoryPackage[];
  recommendation: {
    topChoice: string;
    reasoning: string;
  };
}

export async function suggestLatestForCategory(
  input: SuggestLatestForCategoryInput,
): Promise<SuggestLatestForCategoryResult> {
  const categoryName = getCategoryName(input.category);

  // Get curated comparison if available
  const curated = getCuratedComparison(input.category);
  let packageNames: string[];

  if (curated && curated.packages && curated.packages.length > 0) {
    packageNames = curated.packages;
  } else {
    // Try to find packages from COMPARISON_CATEGORIES
    const compCategory = COMPARISON_CATEGORIES.find((c) => c.id === input.category);
    if (compCategory && compCategory.packages && compCategory.packages.length > 0) {
      packageNames = compCategory.packages;
    } else {
      throw new Error(
        `No packages found for category '${input.category}'. Use list_comparison_categories to see available categories.`,
      );
    }
  }

  // Get latest health for all packages
  const healthPromises = packageNames.map(async (name) => {
    try {
      return await getLatestWithHealth({ name, includeAlternatives: false });
    } catch {
      return null;
    }
  });

  const healthResults = (await Promise.all(healthPromises)).filter(
    (h): h is Awaited<ReturnType<typeof getLatestWithHealth>> => h !== null,
  );

  // Filter by minimum health score
  const filtered = healthResults.filter((h) => h.health.score >= input.minHealthScore!);

  // Sort by health score and downloads
  filtered.sort((a, b) => {
    if (a.health.score !== b.health.score) {
      return b.health.score - a.health.score;
    }
    // Would need downloads data - using health score as tiebreaker
    return 0;
  });

  // Limit results
  const topPackages = filtered.slice(0, input.limit!);

  // Build package list with recommendations
  const packages: CategoryPackage[] = topPackages.map((pkg) => {
    const whyRecommended: string[] = [];

    if (pkg.health.score >= 80) {
      whyRecommended.push("Excellent health score");
    }
    if (pkg.security.vulnerabilities.total === 0) {
      whyRecommended.push("No security vulnerabilities");
    }
    if (pkg.maintenance.isWellMaintained) {
      whyRecommended.push("Well maintained");
    }
    if (pkg.health.status === "healthy") {
      whyRecommended.push("Active development");
    }

    return {
      name: pkg.package.name,
      latestVersion: pkg.package.latestVersion,
      healthScore: pkg.health.score,
      weeklyDownloads: 0, // Would need to fetch separately
      vulnerabilities: pkg.security.vulnerabilities.total,
      isSafeToUse: pkg.recommendation.safeToUse,
      whyRecommended,
    };
  });

  // Get top recommendation
  const topChoice = packages[0]?.name || "";
  let reasoning = "";
  if (packages.length > 0 && packages[0]) {
    const top = packages[0];
    reasoning = `${top.name} has the highest health score (${top.healthScore}/100)`;
    if (top.vulnerabilities === 0) {
      reasoning += ", no security vulnerabilities";
    }
    if (top.isSafeToUse) {
      reasoning += ", and is safe to use";
    }
  }

  return {
    category: {
      id: input.category,
      name: categoryName,
    },
    packages,
    recommendation: {
      topChoice,
      reasoning,
    },
  };
}
