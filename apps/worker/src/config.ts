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

const typesenseHost = process.env.TYPESENSE_HOST || "localhost";

export const config = {
  // npm Registry
  npm: {
    registryUrl: "https://registry.npmjs.org",
    replicateUrl: "https://replicate.npmjs.com",
    downloadsUrl: "https://api.npmjs.org/downloads",
  },

  // Typesense Cloud
  typesense: {
    // Use nearest node endpoint for geo load-balancing
    nearestNode: {
      host: typesenseHost,
      port: Number(process.env.TYPESENSE_PORT) || 443,
      protocol: (process.env.TYPESENSE_PROTOCOL as "https" | "http") || "https",
    },
    // Individual nodes for fallback (auto-derived from nearest node for Typesense Cloud)
    nodes: getTypesenseNodes(typesenseHost),
    apiKey: process.env.TYPESENSE_API_KEY || "",
    collectionName: process.env.TYPESENSE_COLLECTION || "packages",
  },

  // Sync settings
  sync: {
    batchSize: 100,
    concurrency: 10,
    rateLimitPerMinute: 1000,
  },
} as const;
