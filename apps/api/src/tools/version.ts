/**
 * get_package_version - Get the latest version of an npm package
 *
 * Optimized: Uses Typesense (indexed) first, falls back to npm registry
 */

import { z } from "zod";
import { versionCache } from "../lib/cache";
import { getLatestVersion, getPackage, getPublishedAt } from "../lib/clients/npm";
import { getPackage as getTypesensePackage } from "../lib/clients/typesense";

export const getPackageVersionSchema = z.object({
  name: z.string().describe("The npm package name (e.g., 'react', '@types/node')"),
});

export type GetPackageVersionInput = z.infer<typeof getPackageVersionSchema>;

export interface GetPackageVersionResult {
  name: string;
  version: string;
  publishedAt: string | null;
}

export async function getPackageVersion(
  input: GetPackageVersionInput,
): Promise<GetPackageVersionResult> {
  // Check cache first (fast path for MCP tool calls)
  const cacheKey = `version:${input.name}`;
  const cached = versionCache.get(cacheKey);
  if (cached) {
    return cached as GetPackageVersionResult;
  }

  // Try Typesense first (O(1) indexed lookup)
  // Verify exact name match to avoid tokenization issues (e.g., "react" vs "re-act")
  const typesensePkg = await getTypesensePackage(input.name);
  if (typesensePkg && typesensePkg.name === input.name) {
    const result = {
      name: typesensePkg.name,
      version: typesensePkg.version,
      publishedAt: typesensePkg.updated ? new Date(typesensePkg.updated).toISOString() : null,
    };
    versionCache.set(cacheKey, result);
    return result;
  }

  // Fall back to npm registry
  const pkg = await getPackage(input.name);

  if (!pkg) {
    throw new Error(`Package '${input.name}' not found`);
  }

  const version = getLatestVersion(pkg);
  const publishedAt = getPublishedAt(pkg);

  const result = {
    name: pkg.name,
    version,
    publishedAt,
  };

  // Cache the result
  versionCache.set(cacheKey, result);

  return result;
}
