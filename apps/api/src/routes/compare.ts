/**
 * Compare Routes - OpenAPI definitions for comparison and search endpoints
 */

import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import {
  CURATED_COMPARISONS,
  compareSpecificPackages,
  type ExtendedCategory,
  generateComparison,
  getCategoryName,
  getComparison as getCuratedComparison,
  inferCategory,
  SEED_CATEGORIES,
  toApiResponse,
} from "@packrun/decisions";
import { comparePackages } from "../tools/compare";
import { fetchPackageMetrics } from "../lib/metrics";
import { searchNpmRegistry } from "../lib/clients/npm";
import { searchPackages as typesenseSearch } from "../lib/clients/typesense";
import {
  CategoriesListResponseSchema,
  ComparePackagesResponseSchema,
  CompareUsageResponseSchema,
  ComparisonResponseSchema,
  ErrorResponseSchema,
  PackageAlternativesResponseSchema,
  SearchResponseSchema,
  SearchHitSchema,
} from "./schemas/responses";

// Define SearchHit type from schema
type SearchHit = typeof SearchHitSchema._output;

// Cache-Control headers
const CACHE = {
  LONG: "public, s-maxage=86400, stale-while-revalidate=3600",
  MEDIUM: "public, s-maxage=21600, stale-while-revalidate=3600",
  SHORT: "public, s-maxage=3600, stale-while-revalidate=600",
  SEARCH: "public, s-maxage=300, stale-while-revalidate=60",
};

// =============================================================================
// Search Route
// =============================================================================

const searchRoute = createRoute({
  method: "get",
  path: "/search",
  tags: ["Search"],
  summary: "Search packages",
  description: "Search npm packages by query",
  request: {
    query: z.object({
      q: z.string().openapi({ description: "Search query", example: "react" }),
      page: z.string().optional().openapi({ description: "Page number", example: "1" }),
      limit: z
        .string()
        .optional()
        .openapi({ description: "Results per page (max 100)", example: "20" }),
    }),
  },
  responses: {
    200: {
      content: { "application/json": { schema: SearchResponseSchema } },
      description: "Search results",
    },
  },
});

// =============================================================================
// Compare Routes
// =============================================================================

const compareGetRoute = createRoute({
  method: "get",
  path: "/api/compare",
  tags: ["Compare"],
  summary: "Compare packages or list categories",
  description:
    "Multi-purpose comparison endpoint. List categories, get category comparison, find alternatives, or compare specific packages.",
  request: {
    query: z.object({
      list: z
        .string()
        .optional()
        .openapi({ description: "Set to 'categories' to list all categories" }),
      category: z
        .string()
        .optional()
        .openapi({ description: "Category ID to get comparison for", example: "http-client" }),
      package: z
        .string()
        .optional()
        .openapi({ description: "Package name to find alternatives for", example: "axios" }),
      packages: z.string().optional().openapi({
        description: "Comma-separated package names to compare",
        example: "axios,got,ky",
      }),
    }),
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: z.union([
            CategoriesListResponseSchema,
            ComparisonResponseSchema,
            PackageAlternativesResponseSchema,
            CompareUsageResponseSchema,
          ]),
        },
      },
      description: "Comparison result (varies by query parameters)",
    },
    404: {
      content: { "application/json": { schema: ErrorResponseSchema } },
      description: "Category or package not found",
    },
    400: {
      content: { "application/json": { schema: ErrorResponseSchema } },
      description: "Invalid request",
    },
  },
});

const comparePostRoute = createRoute({
  method: "post",
  path: "/api/compare",
  tags: ["Compare"],
  summary: "Compare specific packages",
  description: "Compare 2-5 npm packages side by side",
  request: {
    body: {
      content: {
        "application/json": {
          schema: z.object({
            packages: z
              .array(z.string())
              .min(2)
              .max(5)
              .openapi({
                description: "Array of package names to compare",
                example: ["react", "vue", "svelte"],
              }),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      content: { "application/json": { schema: ComparePackagesResponseSchema } },
      description: "Package comparison",
    },
    400: {
      content: { "application/json": { schema: ErrorResponseSchema } },
      description: "Invalid request",
    },
  },
});

// =============================================================================
// Create Router
// =============================================================================

export function createCompareRoutes() {
  const app = new OpenAPIHono();

  // GET /search
  app.openapi(searchRoute, async (c) => {
    const query = c.req.query("q") || "";
    const page = Number.parseInt(c.req.query("page") || "1");
    const limit = Math.min(Number.parseInt(c.req.query("limit") || "20"), 100);

    if (!query.trim()) {
      return c.json({ hits: [] as SearchHit[], found: 0, page: 1 }, 200);
    }

    let hits: SearchHit[] = [];
    let typesenseWorked = false;

    try {
      const results = await typesenseSearch(query, { limit });
      hits = results.map((pkg) => ({
        id: pkg.id,
        name: pkg.name,
        description: pkg.description,
        version: pkg.version,
        downloads: pkg.downloads,
        hasTypes: pkg.hasTypes,
        license: pkg.license,
        deprecated: pkg.deprecated,
        deprecatedMessage: pkg.deprecatedMessage,
        author: pkg.author,
        homepage: pkg.homepage,
        repository: pkg.repository,
        keywords: pkg.keywords,
        stars: pkg.stars,
        isESM: pkg.isESM,
        isCJS: pkg.isCJS,
        dependencies: pkg.dependencies,
        maintainers: pkg.maintainers,
        created: pkg.created,
        updated: pkg.updated,
        vulnerabilities: pkg.vulnerabilities,
        funding: pkg.funding,
      }));
      typesenseWorked = true;
    } catch (error) {
      console.error("Typesense search failed, falling back to npm:", error);
    }

    // Fallback to npm search if Typesense failed or has few results (only on page 1)
    if (page === 1 && (!typesenseWorked || hits.length < 3)) {
      const npmResults = await searchNpmRegistry(query, limit);

      if (!typesenseWorked) {
        hits = npmResults as SearchHit[];
      } else {
        const existingNames = new Set(hits.map((h) => h.name));
        const newHits = (npmResults as SearchHit[]).filter((r) => !existingNames.has(r.name));
        hits = [...hits, ...newHits].slice(0, limit);
      }
    }

    c.header("Cache-Control", CACHE.SEARCH);
    return c.json({ hits, found: hits.length, page }, 200);
  });

  // GET /api/compare - Using regular route for complex union response
  app.get("/api/compare", async (c) => {
    const packages = c.req.query("packages")?.split(",").filter(Boolean);
    const category = c.req.query("category");
    const packageName = c.req.query("package");
    const listCategories = c.req.query("list") === "categories";

    try {
      // List all available categories
      if (listCategories) {
        const categories = SEED_CATEGORIES.map((cat) => ({
          id: cat.id,
          name: cat.name,
          keywords: cat.keywords.slice(0, 5),
          source: "seed" as const,
          confidence: 1,
        }));

        c.header("Cache-Control", CACHE.MEDIUM);
        return c.json({
          categories,
          curatedCount: CURATED_COMPARISONS.length,
          seedCategories: categories.length,
          discoveredCategories: 0,
          totalCategories: categories.length,
        });
      }

      // Get comparison for a specific category
      if (category) {
        const curated = getCuratedComparison(category);
        if (curated) {
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
            c.header("Cache-Control", CACHE.MEDIUM);
            return c.json(toApiResponse(comparison));
          }

          c.header("Cache-Control", CACHE.MEDIUM);
          return c.json(curated);
        }

        return c.json(
          { error: "Category not found. Use ?list=categories to see available categories." },
          404,
        );
      }

      // Find alternatives for a specific package
      if (packageName && !packages) {
        const metrics = await fetchPackageMetrics(packageName);
        if (!metrics) {
          return c.json({ error: "Package not found" }, 404);
        }

        const categoryId = inferCategory(metrics.keywords);
        if (!categoryId) {
          c.header("Cache-Control", CACHE.SHORT);
          return c.json({
            package: packageName,
            category: null,
            alternatives: [],
            message: "Could not determine package category from keywords",
          });
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
            c.header("Cache-Control", CACHE.MEDIUM);
            return c.json({
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
            });
          }
        }

        c.header("Cache-Control", CACHE.SHORT);
        return c.json({
          package: packageName,
          category: categoryId,
          categoryName: getCategoryName(categoryId),
          alternatives: [],
          message: "No curated comparison available for this category yet",
        });
      }

      // Compare specific packages
      if (packages && packages.length >= 2) {
        const comparison = await compareSpecificPackages(packages, fetchPackageMetrics);

        if (!comparison) {
          return c.json({ error: "Could not fetch metrics for the requested packages" }, 400);
        }

        c.header("Cache-Control", CACHE.MEDIUM);
        return c.json(toApiResponse(comparison));
      }

      // Default: return usage info
      c.header("Cache-Control", CACHE.LONG);
      return c.json({
        message: "Package Comparison API",
        usage: {
          "List categories": "GET /api/compare?list=categories",
          "Get category comparison": "GET /api/compare?category=http-client",
          "Find alternatives": "GET /api/compare?package=axios",
          "Compare specific packages": "GET /api/compare?packages=axios,got,ky",
        },
        availableCategories: SEED_CATEGORIES.slice(0, 10).map((cat) => cat.id),
        seedCategories: SEED_CATEGORIES.length,
        totalCategories: SEED_CATEGORIES.length,
      });
    } catch (error) {
      console.error("Compare API error:", error);
      return c.json({ error: "Failed to generate comparison" }, 500);
    }
  });

  // POST /api/compare - Using regular route for complex response
  app.post("/api/compare", async (c) => {
    try {
      const body = await c.req.json();
      const result = await comparePackages({ packages: body.packages });
      c.header("Cache-Control", CACHE.SHORT);
      return c.json(result);
    } catch (error) {
      return c.json({ error: error instanceof Error ? error.message : "Unknown error" }, 400);
    }
  });

  return app;
}
