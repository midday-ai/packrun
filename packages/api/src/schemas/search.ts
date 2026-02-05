/**
 * Search Schemas
 *
 * Zod schemas for search-related API responses.
 */

import { z } from "zod";

// =============================================================================
// Search
// =============================================================================

export const SearchHitSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  version: z.string(),
  downloads: z.number().optional(),
  hasTypes: z.boolean().optional(),
  license: z.string().optional(),
  deprecated: z.boolean().optional(),
  deprecatedMessage: z.string().optional(),
  author: z.string().optional(),
  homepage: z.string().optional(),
  repository: z.string().optional(),
  keywords: z.array(z.string()).optional(),
  stars: z.number().optional(),
  isESM: z.boolean().optional(),
  isCJS: z.boolean().optional(),
  dependencies: z.number().optional(),
  maintainers: z.array(z.string()).optional(),
  created: z.number().optional(),
  updated: z.number().optional(),
  vulnerabilities: z.number().optional(),
  funding: z.string().optional(),
});

export const SearchResponseSchema = z.object({
  hits: z.array(SearchHitSchema),
  found: z.number(),
  page: z.number(),
});

export const SearchInputSchema = z.object({
  q: z.string().min(1).describe("Search query"),
  page: z.number().int().min(1).default(1).optional(),
  limit: z.number().int().min(1).max(100).default(20).optional(),
});

// Type exports
export type SearchHit = z.infer<typeof SearchHitSchema>;
export type SearchResponse = z.infer<typeof SearchResponseSchema>;
export type SearchInput = z.infer<typeof SearchInputSchema>;
