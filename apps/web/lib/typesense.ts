import Typesense from "typesense";

// Get Typesense host from environment variable
const TYPESENSE_HOST = process.env.TYPESENSE_HOST || "localhost";

// Helper to derive Typesense Cloud SDN nodes from the nearest node host
function getTypesenseNodes(host: string) {
  // Typesense Cloud SDN uses pattern: xxx.a1.typesense.net -> xxx-1.a1.typesense.net
  if (host.includes(".a1.typesense.net")) {
    return [
      { host: host.replace(".a1.", "-1.a1."), port: 443, protocol: "https" as const },
      { host: host.replace(".a1.", "-2.a1."), port: 443, protocol: "https" as const },
      { host: host.replace(".a1.", "-3.a1."), port: 443, protocol: "https" as const },
    ];
  }
  // For non-cloud setups, just use the single host
  return [{ host, port: 443, protocol: "https" as const }];
}

const TYPESENSE_NODES = getTypesenseNodes(TYPESENSE_HOST);

const TYPESENSE_NEAREST_NODE = {
  host: TYPESENSE_HOST,
  port: 443,
  protocol: "https" as const,
};

// Server-side client (for API routes)
export function getTypesenseClient() {
  return new Typesense.Client({
    nearestNode: TYPESENSE_NEAREST_NODE,
    nodes: TYPESENSE_NODES,
    apiKey: process.env.TYPESENSE_API_KEY || "",
    connectionTimeoutSeconds: 5,
  });
}

// Search-only config for client-side (InstantSearch)
export const typesenseSearchConfig = {
  server: {
    apiKey: process.env.NEXT_PUBLIC_TYPESENSE_SEARCH_API_KEY || "",
    nearestNode: TYPESENSE_NEAREST_NODE,
    nodes: TYPESENSE_NODES,
  },
  additionalSearchParameters: {
    query_by: "name,description,keywords,author",
    sort_by: "_text_match:desc,downloads:desc",
    highlight_full_fields: "name,description",
    num_typos: 2,
  },
};

export interface SearchResult {
  name: string;
  description?: string;
  version: string;
  downloads: number;
  hasTypes: boolean;
  isESM: boolean;
  isCJS: boolean;
  author?: string;
  updated: number;
}

export async function searchPackages(
  query: string,
  options: { page?: number; perPage?: number; hasTypes?: boolean; isESM?: boolean } = {},
): Promise<{ hits: SearchResult[]; found: number; page: number }> {
  const { page = 1, perPage = 20, hasTypes, isESM } = options;

  const client = getTypesenseClient();

  // Build filters
  const filters: string[] = [];
  if (hasTypes !== undefined) filters.push(`hasTypes:${hasTypes}`);
  if (isESM !== undefined) filters.push(`isESM:${isESM}`);

  const results = await client
    .collections("packages")
    .documents()
    .search({
      q: query,
      query_by: "name,description,keywords,author",
      sort_by: query ? "_text_match:desc,downloads:desc" : "downloads:desc",
      filter_by: filters.length > 0 ? filters.join(" && ") : undefined,
      page,
      per_page: perPage,
      num_typos: 2,
      highlight_full_fields: "name,description",
    });

  return {
    hits: (results.hits || []).map((hit) => hit.document as unknown as SearchResult),
    found: results.found || 0,
    page: results.page || 1,
  };
}
