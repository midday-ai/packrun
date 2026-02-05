/**
 * Compare Schemas
 *
 * Zod schemas for package comparison API responses.
 */

import { z } from "zod";

// =============================================================================
// Compare Packages
// =============================================================================

export const PackageComparisonDataSchema = z.object({
  name: z.string(),
  version: z.string(),
  weeklyDownloads: z.number(),
  hasTypes: z.boolean(),
  isESM: z.boolean(),
  isCJS: z.boolean(),
  vulnerabilities: z.number(),
});

export const ComparePackagesResponseSchema = z.object({
  packages: z.array(PackageComparisonDataSchema),
  curatedComparison: z
    .object({
      category: z.string(),
      categoryName: z.string(),
      recommendation: z.string(),
      reasoning: z.string(),
      comparison: z.record(z.string(), z.record(z.string(), z.unknown()).optional()),
    })
    .nullable(),
});

// =============================================================================
// Categories
// =============================================================================

export const CategoryInfoSchema = z.object({
  id: z.string(),
  name: z.string(),
  keywords: z.array(z.string()),
  source: z.string(),
  confidence: z.number(),
});

export const CategoriesListResponseSchema = z.object({
  categories: z.array(CategoryInfoSchema),
  curatedCount: z.number(),
  seedCategories: z.number(),
  discoveredCategories: z.number(),
  totalCategories: z.number(),
});

// =============================================================================
// Package Alternatives
// =============================================================================

export const PackageAlternativeSchema = z.object({
  name: z.string(),
  score: z.number().optional(),
  badges: z.array(z.string()).optional(),
});

export const PackageAlternativesResponseSchema = z.object({
  package: z.string(),
  category: z.string().nullable(),
  categoryName: z.string().optional(),
  alternatives: z.array(PackageAlternativeSchema),
  comparison: z.unknown().optional(),
  message: z.string().optional(),
});

// =============================================================================
// Category Comparison
// =============================================================================

export const ComparisonPackageSchema = z.object({
  name: z.string(),
  score: z.number(),
  badges: z.array(z.string()),
  version: z.string().optional(),
  weeklyDownloads: z.number().optional(),
  stars: z.number().optional(),
  hasTypes: z.boolean().optional(),
  isESM: z.boolean().optional(),
  lastUpdated: z.string().optional(),
  license: z.string().optional(),
});

export const ComparisonResponseSchema = z.object({
  category: z.string(),
  categoryName: z.string(),
  packages: z.array(ComparisonPackageSchema),
  winner: z.string().optional(),
  reasoning: z.string().optional(),
});

export const CompareUsageResponseSchema = z.object({
  message: z.string(),
  usage: z.record(z.string(), z.string()),
  availableCategories: z.array(z.string()),
  seedCategories: z.number(),
  totalCategories: z.number(),
});

// Type exports
export type PackageComparisonData = z.infer<typeof PackageComparisonDataSchema>;
export type ComparePackagesResponse = z.infer<typeof ComparePackagesResponseSchema>;
export type CategoryInfo = z.infer<typeof CategoryInfoSchema>;
export type CategoriesListResponse = z.infer<typeof CategoriesListResponseSchema>;
export type PackageAlternative = z.infer<typeof PackageAlternativeSchema>;
export type PackageAlternativesResponse = z.infer<typeof PackageAlternativesResponseSchema>;
export type ComparisonPackage = z.infer<typeof ComparisonPackageSchema>;
export type ComparisonResponse = z.infer<typeof ComparisonResponseSchema>;
