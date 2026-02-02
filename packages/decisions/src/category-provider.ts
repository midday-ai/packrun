/**
 * Category Provider
 *
 * Merges seed categories (from code) with discovered categories (from Redis).
 * Provides a unified interface for accessing all categories.
 */

import { type CategoryDefinition, SEED_CATEGORIES } from "./categories";

/**
 * Discovered category from Redis
 */
export interface DiscoveredCategory {
  id: string;
  name: string;
  keywords: string[];
  packages: string[];
  confidence: number;
  discoveredAt: number;
  packageCount: number;
}

/**
 * Extended category definition that includes discovered metadata
 */
export interface ExtendedCategory extends CategoryDefinition {
  source: "seed" | "discovered";
  confidence?: number;
  packageCount?: number;
  discoveredAt?: number;
}

/**
 * Redis client interface (minimal subset needed)
 */
export interface RedisClient {
  hgetall(key: string): Promise<Record<string, string>>;
  hget(key: string, field: string): Promise<string | null>;
}

/**
 * Get all categories (seed + discovered)
 *
 * @param redis - Optional Redis client. If not provided, returns only seed categories.
 */
export async function getAllCategories(redis?: RedisClient): Promise<ExtendedCategory[]> {
  // Start with seed categories
  const categories: ExtendedCategory[] = SEED_CATEGORIES.map((cat) => ({
    ...cat,
    source: "seed" as const,
  }));

  const categoryIds = new Set(categories.map((c) => c.id));

  // Merge discovered categories from Redis if available
  if (redis) {
    try {
      const discovered = await redis.hgetall("categories:discovered");

      for (const value of Object.values(discovered)) {
        try {
          const cat: DiscoveredCategory = JSON.parse(value);

          // Skip if ID already exists in seed categories
          if (categoryIds.has(cat.id)) {
            continue;
          }

          // Add as extended category
          categories.push({
            id: cat.id,
            name: cat.name,
            keywords: cat.keywords,
            minMatches: 1,
            source: "discovered",
            confidence: cat.confidence,
            packageCount: cat.packageCount,
            discoveredAt: cat.discoveredAt,
          });

          categoryIds.add(cat.id);
        } catch {
          // Skip invalid entries
        }
      }
    } catch (error) {
      console.error("Failed to load discovered categories:", error);
      // Continue with seed categories only
    }
  }

  return categories;
}

/**
 * Get a specific category by ID
 */
export async function getCategoryById(
  id: string,
  redis?: RedisClient,
): Promise<ExtendedCategory | null> {
  // Check seed categories first
  const seedCategory = SEED_CATEGORIES.find((c) => c.id === id);
  if (seedCategory) {
    return { ...seedCategory, source: "seed" };
  }

  // Check discovered categories
  if (redis) {
    try {
      const discovered = await redis.hgetall("categories:discovered");
      const raw = discovered[id];

      if (raw) {
        const cat: DiscoveredCategory = JSON.parse(raw);
        return {
          id: cat.id,
          name: cat.name,
          keywords: cat.keywords,
          minMatches: 1,
          source: "discovered",
          confidence: cat.confidence,
          packageCount: cat.packageCount,
          discoveredAt: cat.discoveredAt,
        };
      }
    } catch {
      // Fall through
    }
  }

  return null;
}

/**
 * Get category statistics
 */
export async function getCategoryStats(redis?: RedisClient): Promise<{
  seed: number;
  discovered: number;
  total: number;
}> {
  const seedCount = SEED_CATEGORIES.length;
  let discoveredCount = 0;

  if (redis) {
    try {
      const discovered = await redis.hgetall("categories:discovered");
      // Filter out categories that overlap with seed categories
      const seedIds = new Set(SEED_CATEGORIES.map((c) => c.id));
      discoveredCount = Object.keys(discovered).filter((id) => !seedIds.has(id)).length;
    } catch {
      // Ignore errors
    }
  }

  return {
    seed: seedCount,
    discovered: discoveredCount,
    total: seedCount + discoveredCount,
  };
}

/**
 * Infer category from package keywords using both seed and discovered categories
 */
export async function inferCategoryExtended(
  keywords: string[],
  redis?: RedisClient,
): Promise<{ category: string; source: "seed" | "discovered" } | null> {
  if (!keywords || keywords.length === 0) return null;

  const categories = await getAllCategories(redis);
  const lowerKeywords = keywords.map((k) => k.toLowerCase());

  let bestMatch: { category: string; source: "seed" | "discovered"; score: number } | null = null;

  for (const category of categories) {
    let matchCount = 0;

    for (const catKeyword of category.keywords) {
      if (
        lowerKeywords.some(
          (k) => k === catKeyword || k.includes(catKeyword) || catKeyword.includes(k),
        )
      ) {
        matchCount++;
      }
    }

    if (matchCount >= category.minMatches) {
      const score = matchCount / category.keywords.length;
      // Prefer seed categories if tied
      const adjustedScore = category.source === "seed" ? score + 0.001 : score;

      if (!bestMatch || adjustedScore > bestMatch.score) {
        bestMatch = { category: category.id, source: category.source, score: adjustedScore };
      }
    }
  }

  return bestMatch ? { category: bestMatch.category, source: bestMatch.source } : null;
}
