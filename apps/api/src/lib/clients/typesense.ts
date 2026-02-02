/**
 * Typesense Client for API
 *
 * Provides fast package lookups and category-based alternative discovery.
 */

import Typesense from "typesense";

// Initialize client from environment
const protocol = process.env.TYPESENSE_PROTOCOL || "https";
const defaultPort = protocol === "https" ? 443 : 8108;

const typesenseClient = new Typesense.Client({
  nodes: [
    {
      host: process.env.TYPESENSE_HOST || "localhost",
      port: Number.parseInt(process.env.TYPESENSE_PORT || String(defaultPort)),
      protocol,
    },
  ],
  apiKey: process.env.TYPESENSE_API_KEY || "xyz",
  connectionTimeoutSeconds: 5,
  retryIntervalSeconds: 0.1,
});

const COLLECTION_NAME = process.env.TYPESENSE_COLLECTION || "packages";

/**
 * Package document from Typesense
 */
export interface PackageDocument {
  id: string;
  name: string;
  description?: string;
  keywords?: string[];
  author?: string;
  version: string;
  license?: string;
  homepage?: string;
  repository?: string;
  downloads: number;
  updated: number;
  created: number;
  hasTypes: boolean;
  isESM: boolean;
  isCJS: boolean;
  dependencies: number;
  maintainers?: string[];
  nodeVersion?: string;
  deprecated?: boolean;
  deprecatedMessage?: string;
  maintenanceScore?: number;
  vulnerabilities?: number;
  vulnCritical?: number;
  vulnHigh?: number;
  hasInstallScripts?: boolean;
  stars?: number;
  dependents?: number;
  typesPackage?: string;
  funding?: string;
  // New fields
  inferredCategory?: string;
  moduleFormat?: string;
  hasBin?: boolean;
  licenseType?: string;
  hasProvenance?: boolean;
  unpackedSize?: number;
  isStable?: boolean;
  authorGithub?: string;
}

/**
 * Get a package by exact name
 */
export async function getPackage(name: string): Promise<PackageDocument | null> {
  try {
    const result = await typesenseClient
      .collections(COLLECTION_NAME)
      .documents()
      .search({
        q: name,
        query_by: "name",
        filter_by: `name:=${name}`,
        per_page: 1,
      });
    if (result.hits && result.hits.length > 0) {
      return result.hits[0]?.document as PackageDocument;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Search for packages
 */
export async function searchPackages(
  query: string,
  options?: {
    limit?: number;
    filters?: string;
  },
): Promise<PackageDocument[]> {
  try {
    const result = await typesenseClient
      .collections(COLLECTION_NAME)
      .documents()
      .search({
        q: query,
        query_by: "name,description,keywords",
        per_page: options?.limit || 10,
        filter_by: options?.filters,
      });

    return (result.hits || []).map((hit) => hit.document as PackageDocument);
  } catch {
    return [];
  }
}

/**
 * Find alternatives by category
 */
export async function findAlternativesByCategory(
  category: string,
  excludePackage: string,
  limit = 5,
): Promise<PackageDocument[]> {
  try {
    const result = await typesenseClient
      .collections(COLLECTION_NAME)
      .documents()
      .search({
        q: "*",
        query_by: "name",
        filter_by: `inferredCategory:=${category} && name:!=${excludePackage} && deprecated:=false`,
        sort_by: "downloads:desc",
        per_page: limit,
      });

    return (result.hits || []).map((hit) => hit.document as PackageDocument);
  } catch {
    return [];
  }
}

/**
 * Get multiple packages by names
 */
export async function getPackages(names: string[]): Promise<Map<string, PackageDocument>> {
  const results = new Map<string, PackageDocument>();

  // Typesense doesn't have native multi-get, so we use a filter
  if (names.length === 0) return results;

  try {
    const filterParts = names.map((n) => `name:=${n}`);
    const result = await typesenseClient
      .collections(COLLECTION_NAME)
      .documents()
      .search({
        q: "*",
        query_by: "name",
        filter_by: filterParts.join(" || "),
        per_page: names.length,
      });

    for (const hit of result.hits || []) {
      const doc = hit.document as PackageDocument;
      results.set(doc.name, doc);
    }
  } catch {
    // Fall back to individual queries
    for (const name of names) {
      const doc = await getPackage(name);
      if (doc) results.set(name, doc);
    }
  }

  return results;
}

export { typesenseClient };
