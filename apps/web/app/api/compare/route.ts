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
} from "@v1/decisions";
import { type NextRequest, NextResponse } from "next/server";
import { fetchPackageMetrics } from "@/lib/metrics";

// In-memory cache for generated comparisons
const comparisonCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

// Cache for all categories
let categoriesCache: { data: ExtendedCategory[]; timestamp: number } | null = null;
const CATEGORIES_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function getCachedCategories(): Promise<ExtendedCategory[]> {
  if (categoriesCache && Date.now() - categoriesCache.timestamp < CATEGORIES_CACHE_TTL) {
    return categoriesCache.data;
  }

  // Without Redis, only use seed categories
  const categories: ExtendedCategory[] = SEED_CATEGORIES.map((c) => ({
    ...c,
    source: "seed" as const,
    confidence: 1,
  }));

  categoriesCache = { data: categories, timestamp: Date.now() };
  return categories;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const packages = searchParams.get("packages")?.split(",").filter(Boolean);
  const category = searchParams.get("category");
  const packageName = searchParams.get("package");
  const listCategories = searchParams.get("list") === "categories";

  try {
    // List all available categories (seed only without Redis)
    if (listCategories) {
      const categories = await getCachedCategories();

      return NextResponse.json({
        categories: categories.map((c) => ({
          id: c.id,
          name: c.name,
          keywords: c.keywords.slice(0, 5),
          source: c.source,
          confidence: c.confidence,
        })),
        curatedCount: CURATED_COMPARISONS.length,
        seedCategories: categories.length,
        discoveredCategories: 0,
        totalCategories: categories.length,
      });
    }

    // Get comparison for a specific category
    if (category) {
      // Check cache
      const cacheKey = `category:${category}`;
      const cached = comparisonCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return NextResponse.json(cached.data);
      }

      // Try curated comparison first
      const curated = getCuratedComparison(category);
      if (curated) {
        // Enhance curated with live scores
        const metrics = await Promise.all(curated.packages.map((p) => fetchPackageMetrics(p)));

        const validMetrics = metrics.filter((m) => m !== null);
        if (validMetrics.length >= 2) {
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
            const response = toApiResponse(comparison);
            comparisonCache.set(cacheKey, { data: response, timestamp: Date.now() });
            return NextResponse.json(response);
          }
        }

        // Fall back to curated data if metrics fail
        return NextResponse.json(curated);
      }

      // Category not found
      return NextResponse.json(
        { error: "Category not found. Use ?list=categories to see available categories." },
        { status: 404 },
      );
    }

    // Find alternatives for a specific package
    if (packageName && !packages) {
      const cacheKey = `alternatives:${packageName}`;
      const cached = comparisonCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return NextResponse.json(cached.data);
      }

      // Get package data to find its keywords
      const metrics = await fetchPackageMetrics(packageName);
      if (!metrics) {
        return NextResponse.json({ error: "Package not found" }, { status: 404 });
      }

      const categoryId = inferCategory(metrics.keywords);
      if (!categoryId) {
        return NextResponse.json({
          package: packageName,
          category: null,
          alternatives: [],
          message: "Could not determine package category from keywords",
        });
      }

      // Find the curated comparison for this category
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
          const response = {
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
          comparisonCache.set(cacheKey, { data: response, timestamp: Date.now() });
          return NextResponse.json(response);
        }
      }

      return NextResponse.json({
        package: packageName,
        category: categoryId,
        categoryName: getCategoryName(categoryId),
        alternatives: [],
        message: "No curated comparison available for this category yet",
      });
    }

    // Compare specific packages
    if (packages && packages.length >= 2) {
      const cacheKey = `compare:${packages.sort().join(",")}`;
      const cached = comparisonCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return NextResponse.json(cached.data);
      }

      const comparison = await compareSpecificPackages(packages, fetchPackageMetrics);

      if (!comparison) {
        return NextResponse.json(
          { error: "Could not fetch metrics for the requested packages" },
          { status: 400 },
        );
      }

      const response = toApiResponse(comparison);
      comparisonCache.set(cacheKey, { data: response, timestamp: Date.now() });
      return NextResponse.json(response);
    }

    // Default: return summary of available comparisons
    const categories = await getCachedCategories();

    return NextResponse.json({
      message: "Package Comparison API",
      usage: {
        "List categories": "GET /api/compare?list=categories",
        "Get category comparison": "GET /api/compare?category=http-client",
        "Find alternatives": "GET /api/compare?package=axios",
        "Compare specific packages": "GET /api/compare?packages=axios,got,ky",
      },
      availableCategories: SEED_CATEGORIES.slice(0, 10).map((c) => c.id),
      seedCategories: categories.length,
      discoveredCategories: 0,
      totalCategories: categories.length,
    });
  } catch (error) {
    console.error("Compare API error:", error);
    return NextResponse.json({ error: "Failed to generate comparison" }, { status: 500 });
  }
}
