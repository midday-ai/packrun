/**
 * compare_packages - Compare multiple packages side by side
 */

import { fetchVulnerabilities } from "@packrun/data/osv";
import { comparePackages as comparePackagesFromDecisions } from "@packrun/decisions/comparisons";
import { z } from "zod";
import { compareCache } from "../lib/cache";
import {
  getDownloads,
  getLatestVersion,
  getPackage,
  hasTypes,
  isCJS,
  isESM,
} from "../lib/clients/npm";

export const comparePackagesSchema = z.object({
  packages: z
    .array(z.string())
    .min(2)
    .max(5)
    .describe("Array of package names to compare (2-5 packages)"),
});

export type ComparePackagesInput = z.infer<typeof comparePackagesSchema>;

interface PackageComparisonData {
  name: string;
  version: string;
  weeklyDownloads: number;
  hasTypes: boolean;
  isESM: boolean;
  isCJS: boolean;
  vulnerabilities: number;
}

export interface ComparePackagesResult {
  packages: PackageComparisonData[];
  curatedComparison: {
    category: string;
    categoryName: string;
    recommendation: string;
    reasoning: string;
    comparison: Record<string, Record<string, unknown> | undefined>;
  } | null;
}

export async function comparePackages(input: ComparePackagesInput): Promise<ComparePackagesResult> {
  // Check cache first (fast path for MCP tool calls)
  // Use sorted package names as cache key for consistent lookups
  const cacheKey = `compare:${[...input.packages].sort().join(",")}`;
  const cached = compareCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  // Fetch live data for all packages in parallel
  const packageDataPromises = input.packages.map(async (name) => {
    const [pkg, downloads] = await Promise.all([getPackage(name), getDownloads(name)]);

    if (!pkg) {
      throw new Error(`Package '${name}' not found`);
    }

    const version = getLatestVersion(pkg);
    const vulns = await fetchVulnerabilities(name, version);

    return {
      name: pkg.name,
      version,
      weeklyDownloads: downloads?.downloads || 0,
      hasTypes: hasTypes(pkg),
      isESM: isESM(pkg),
      isCJS: isCJS(pkg),
      vulnerabilities: vulns.total,
    };
  });

  const packages = await Promise.all(packageDataPromises);

  // Check for curated comparison data
  const curatedComparison = comparePackagesFromDecisions(input.packages);

  const result = {
    packages,
    curatedComparison: curatedComparison
      ? {
          category: curatedComparison.category,
          categoryName: curatedComparison.categoryName,
          recommendation: curatedComparison.recommendation,
          reasoning: curatedComparison.reasoning,
          comparison: curatedComparison.comparison,
        }
      : null,
  };

  // Cache the result
  compareCache.set(cacheKey, result);

  return result;
}
