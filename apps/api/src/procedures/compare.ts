/**
 * Compare Procedures
 *
 * oRPC procedures for package comparison endpoints.
 */

import { ORPCError } from "@orpc/server";
import { publicProcedure } from "@packrun/api";
import {
  CategoriesListResponseSchema,
  ComparePackagesResponseSchema,
  ComparisonResponseSchema,
  PackageAlternativesResponseSchema,
} from "@packrun/api/schemas";
import {
  CURATED_COMPARISONS,
  compareSpecificPackages,
  generateComparison,
  getCategoryName,
  getComparison as getCuratedComparison,
  inferCategory,
  SEED_CATEGORIES,
  toApiResponse,
} from "@packrun/decisions";
import { z } from "zod";
import { fetchPackageMetrics } from "../lib/metrics";
import { comparePackages } from "../tools/compare";

/**
 * List all available categories
 */
export const listCategories = publicProcedure
  .route({
    method: "GET",
    path: "/v1/compare/categories",
    summary: "List categories",
    description: "List all available package categories for comparison",
    tags: ["Compare"],
  })
  .output(CategoriesListResponseSchema)
  .handler(async () => {
    const categories = SEED_CATEGORIES.map((cat) => ({
      id: cat.id,
      name: cat.name,
      keywords: cat.keywords.slice(0, 5),
      source: "seed" as const,
      confidence: 1,
    }));

    return {
      categories,
      curatedCount: CURATED_COMPARISONS.length,
      seedCategories: categories.length,
      discoveredCategories: 0,
      totalCategories: categories.length,
    };
  });

/**
 * Get comparison for a specific category
 */
export const getCategory = publicProcedure
  .route({
    method: "GET",
    path: "/v1/compare/category/{category}",
    summary: "Get category comparison",
    description: "Get a curated comparison of packages in a category",
    tags: ["Compare"],
  })
  .input(z.object({ category: z.string() }))
  .output(ComparisonResponseSchema)
  .handler(async ({ input }) => {
    const curated = getCuratedComparison(input.category);
    if (!curated) {
      throw new ORPCError("NOT_FOUND", {
        message: "Category not found. Use /v1/compare/categories to see available categories.",
      });
    }

    const comparison = await generateComparison(
      {
        category: curated.category,
        categoryName: curated.categoryName,
        packages: curated.packages,
        confidence: 1,
        discoveredVia: "manual",
      },
      fetchPackageMetrics,
    );

    if (comparison) {
      return toApiResponse(comparison);
    }

    // Return curated data as fallback
    return {
      category: curated.category,
      categoryName: curated.categoryName,
      packages: curated.packages.map((name) => ({
        name,
        score: 0,
        badges: [],
      })),
    };
  });

/**
 * Find alternatives for a specific package
 */
export const getAlternatives = publicProcedure
  .route({
    method: "GET",
    path: "/v1/compare/alternatives/{name}",
    summary: "Find alternatives",
    description: "Find alternative packages for a given package",
    tags: ["Compare"],
  })
  .input(z.object({ name: z.string() }))
  .output(PackageAlternativesResponseSchema)
  .handler(async ({ input }) => {
    const packageName = decodeURIComponent(input.name);

    const metrics = await fetchPackageMetrics(packageName);
    if (!metrics) {
      throw new ORPCError("NOT_FOUND", {
        message: "Package not found",
      });
    }

    const categoryId = inferCategory(metrics.keywords);
    if (!categoryId) {
      return {
        package: packageName,
        category: null,
        alternatives: [],
        message: "Could not determine package category from keywords",
      };
    }

    const curated = getCuratedComparison(categoryId);
    if (curated && curated.packages.includes(packageName)) {
      const comparison = await generateComparison(
        {
          category: curated.category,
          categoryName: curated.categoryName,
          packages: curated.packages,
          confidence: 1,
          discoveredVia: "manual",
        },
        fetchPackageMetrics,
      );

      if (comparison) {
        return {
          package: packageName,
          category: categoryId,
          categoryName: getCategoryName(categoryId),
          alternatives: comparison.packages
            .filter((p) => p.name !== packageName)
            .map((p) => ({
              name: p.name,
              score: p.score,
              badges: p.badges,
            })),
          comparison: toApiResponse(comparison),
        };
      }
    }

    return {
      package: packageName,
      category: categoryId,
      categoryName: getCategoryName(categoryId),
      alternatives: [],
      message: "No curated comparison available for this category yet",
    };
  });

/**
 * Compare specific packages (POST)
 */
export const comparePackagesProcedure = publicProcedure
  .route({
    method: "POST",
    path: "/v1/compare",
    summary: "Compare specific packages",
    description: "Compare 2-5 npm packages side by side",
    tags: ["Compare"],
  })
  .input(
    z.object({
      packages: z.array(z.string()).min(2).max(5).describe("Array of package names to compare"),
    }),
  )
  .output(ComparePackagesResponseSchema)
  .handler(async ({ input }) => {
    try {
      return await comparePackages({ packages: input.packages });
    } catch (error) {
      throw new ORPCError("BAD_REQUEST", {
        message: error instanceof Error ? error.message : "Failed to compare packages",
      });
    }
  });

/**
 * Compare packages by name (GET with query params)
 */
export const compareByNames = publicProcedure
  .route({
    method: "GET",
    path: "/v1/compare/packages",
    summary: "Compare packages by names",
    description: "Compare specific packages by providing comma-separated names",
    tags: ["Compare"],
  })
  .input(
    z.object({
      names: z.string().describe("Comma-separated package names"),
    }),
  )
  .output(ComparisonResponseSchema)
  .handler(async ({ input }) => {
    const packages = input.names.split(",").filter(Boolean);

    if (packages.length < 2) {
      throw new ORPCError("BAD_REQUEST", {
        message: "At least 2 package names are required",
      });
    }

    const comparison = await compareSpecificPackages(packages, fetchPackageMetrics);

    if (!comparison) {
      throw new ORPCError("BAD_REQUEST", {
        message: "Could not fetch metrics for the requested packages",
      });
    }

    return toApiResponse(comparison);
  });

// =============================================================================
// Router
// =============================================================================

export const compareRouter = {
  listCategories,
  getCategory,
  getAlternatives,
  compare: comparePackagesProcedure,
  compareByNames,
};
