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
      host: process.env.TYPESENSE_HOST || "v2ejq75nb439thdup.a1.typesense.net",
      port: 443,
      protocol: "https",
    },
    // Individual nodes for fallback
    nodes: [
      { host: "v2ejq75nb439thdup-1.a1.typesense.net", port: 443, protocol: "https" },
      { host: "v2ejq75nb439thdup-2.a1.typesense.net", port: 443, protocol: "https" },
      { host: "v2ejq75nb439thdup-3.a1.typesense.net", port: 443, protocol: "https" },
    ],
    apiKey: process.env.TYPESENSE_API_KEY || "",
    collectionName: "packages",
  },

  // Sync settings
  sync: {
    batchSize: 100,
    concurrency: 10,
    rateLimitPerMinute: 1000,
  },
} as const;
