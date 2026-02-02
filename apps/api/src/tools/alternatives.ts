/**
 * find_alternatives - Find alternative packages with recommendations
 */

import {
  COMPARISON_CATEGORIES,
  getAlternatives,
  getComparisonForPackage,
} from "@v1/decisions/comparisons";
import { z } from "zod";

export const findAlternativesSchema = z.object({
  name: z.string().describe("The npm package name to find alternatives for"),
});

export type FindAlternativesInput = z.infer<typeof findAlternativesSchema>;

export interface FindAlternativesResult {
  name: string;
  category: string | null;
  categoryName: string | null;
  alternatives: string[];
  recommended: string | null;
  reason: string | null;
  hasComparison: boolean;
}

export async function findAlternatives(
  input: FindAlternativesInput,
): Promise<FindAlternativesResult> {
  // Check curated alternatives first (for deprecated/maintenance-mode packages)
  const alternativeInfo = getAlternatives(input.name);

  if (alternativeInfo) {
    return {
      name: input.name,
      category: null,
      categoryName: null,
      alternatives: alternativeInfo.alternatives,
      recommended: alternativeInfo.recommended,
      reason: alternativeInfo.reason,
      hasComparison: false,
    };
  }

  // Check if package is in a comparison category
  const comparison = getComparisonForPackage(input.name);

  if (comparison) {
    const alternatives = comparison.packages.filter((p) => p !== input.name);
    return {
      name: input.name,
      category: comparison.category,
      categoryName: comparison.categoryName,
      alternatives,
      recommended: comparison.recommendation !== input.name ? comparison.recommendation : null,
      reason: comparison.reasoning,
      hasComparison: true,
    };
  }

  // Check category list
  const category = COMPARISON_CATEGORIES.find((c) => c.packages.includes(input.name));

  if (category) {
    const alternatives = category.packages.filter((p) => p !== input.name);
    return {
      name: input.name,
      category: category.id,
      categoryName: category.name,
      alternatives,
      recommended: null,
      reason: category.description,
      hasComparison: false,
    };
  }

  // No alternatives found
  return {
    name: input.name,
    category: null,
    categoryName: null,
    alternatives: [],
    recommended: null,
    reason: null,
    hasComparison: false,
  };
}
