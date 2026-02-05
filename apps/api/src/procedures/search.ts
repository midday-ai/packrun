/**
 * Search Procedures
 *
 * oRPC procedures for search endpoints.
 */

import { publicProcedure } from "@packrun/api";
import { type SearchHitSchema, SearchResponseSchema } from "@packrun/api/schemas";
import { api as log } from "@packrun/logger";
import { z } from "zod";
import { searchNpmRegistry } from "../lib/clients/npm";
import { searchPackages as typesenseSearch } from "../lib/clients/typesense";

type SearchHit = z.infer<typeof SearchHitSchema>;

/**
 * Search packages
 */
export const search = publicProcedure
  .route({
    method: "GET",
    path: "/search",
    summary: "Search packages",
    description: "Search npm packages by query",
    tags: ["Search"],
  })
  .input(
    z.object({
      q: z.string().describe("Search query"),
      page: z.coerce.number().int().min(1).default(1).optional(),
      limit: z.coerce.number().int().min(1).max(100).default(20).optional(),
    }),
  )
  .output(SearchResponseSchema)
  .handler(async ({ input }) => {
    const query = input.q || "";
    const page = input.page ?? 1;
    const limit = input.limit ?? 20;

    if (!query.trim()) {
      return { hits: [] as SearchHit[], found: 0, page: 1 };
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
      log.warn("Typesense search failed, falling back to npm:", error);
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

    return { hits, found: hits.length, page };
  });

// =============================================================================
// Router
// =============================================================================

export const searchRouter = {
  packages: search,
};
