/**
 * compare_packages - Compare multiple packages side by side
 */

import { comparePackages as comparePackagesFromDecisions } from "@v1/decisions/comparisons";
import { z } from "zod";
import {
  getDownloads,
  getLatestVersion,
  getPackage,
  hasTypes,
  isCJS,
  isESM,
} from "../lib/clients/npm";
import { fetchVulnerabilities } from "../lib/clients/osv";

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

  return {
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
}
