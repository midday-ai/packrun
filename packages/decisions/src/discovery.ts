/**
 * Alternative discovery engine
 *
 * Automatically discovers which packages are alternatives to each other
 * by analyzing keywords and categorizing packages.
 */

import { CATEGORIES, getCategoryName, inferCategory } from "./categories";
import type { AlternativeGroup } from "./schema";

interface PackageInfo {
  name: string;
  keywords: string[];
  weeklyDownloads: number;
}

/**
 * Discover alternative groups from a list of packages
 */
export function discoverAlternatives(
  packages: PackageInfo[],
  minDownloads = 1000,
  minPackagesPerGroup = 2,
  maxPackagesPerGroup = 20,
): AlternativeGroup[] {
  const groups = new Map<string, string[]>();

  // Categorize each package
  for (const pkg of packages) {
    // Skip packages with low downloads
    if (pkg.weeklyDownloads < minDownloads) continue;

    const category = inferCategory(pkg.keywords);
    if (category) {
      const existing = groups.get(category) || [];
      existing.push(pkg.name);
      groups.set(category, existing);
    }
  }

  // Convert to AlternativeGroup array
  const result: AlternativeGroup[] = [];

  for (const [category, packageNames] of groups) {
    if (packageNames.length < minPackagesPerGroup) continue;

    result.push({
      category,
      categoryName: getCategoryName(category),
      packages: packageNames.slice(0, maxPackagesPerGroup),
      confidence: packageNames.length > 5 ? 1 : 0.8,
      discoveredVia: "keywords",
    });
  }

  // Sort by number of packages (more packages = more useful comparison)
  return result.sort((a, b) => b.packages.length - a.packages.length);
}

/**
 * Find alternatives for a specific package
 */
export function findAlternativesForPackage(
  packageName: string,
  packageKeywords: string[],
  allPackages: PackageInfo[],
  limit = 10,
): AlternativeGroup | null {
  const category = inferCategory(packageKeywords);
  if (!category) return null;

  // Find other packages in the same category
  const alternatives: string[] = [];

  for (const pkg of allPackages) {
    if (pkg.name === packageName) continue;
    if (pkg.weeklyDownloads < 1000) continue;

    const pkgCategory = inferCategory(pkg.keywords);
    if (pkgCategory === category) {
      alternatives.push(pkg.name);
    }
  }

  if (alternatives.length === 0) return null;

  return {
    category,
    categoryName: getCategoryName(category),
    packages: [packageName, ...alternatives.slice(0, limit - 1)],
    confidence: alternatives.length > 3 ? 1 : 0.7,
    discoveredVia: "keywords",
  };
}

/**
 * Get all predefined categories that could have alternatives
 */
export function getPredefinedCategories(): AlternativeGroup[] {
  return CATEGORIES.map((cat) => ({
    category: cat.id,
    categoryName: cat.name,
    packages: [], // Will be populated by discovery
    confidence: 1,
    discoveredVia: "manual" as const,
  }));
}

/**
 * Merge discovered groups with manual overrides
 */
export function mergeWithManualGroups(
  discovered: AlternativeGroup[],
  manual: Array<{ category: string; packages: string[] }>,
): AlternativeGroup[] {
  const result = new Map<string, AlternativeGroup>();

  // Add discovered groups
  for (const group of discovered) {
    result.set(group.category, group);
  }

  // Override with manual groups
  for (const override of manual) {
    const existing = result.get(override.category);
    if (existing) {
      // Merge packages, manual takes priority
      const allPackages = new Set([...override.packages, ...existing.packages]);
      existing.packages = Array.from(allPackages).slice(0, 20);
      existing.discoveredVia = "manual";
      existing.confidence = 1;
    } else {
      result.set(override.category, {
        category: override.category,
        categoryName: getCategoryName(override.category),
        packages: override.packages,
        confidence: 1,
        discoveredVia: "manual",
      });
    }
  }

  return Array.from(result.values());
}
