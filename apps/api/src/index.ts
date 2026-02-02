/**
 * v1.run API Server
 *
 * Hono server with MCP (Model Context Protocol) support for AI agents
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { z } from "zod";
import {
  CURATED_COMPARISONS,
  compareSpecificPackages,
  type ExtendedCategory,
  generateComparison,
  getCategoryName,
  getComparison as getCuratedComparison,
  inferCategory,
  SEED_CATEGORIES,
  toApiResponse,
} from "@v1/decisions";
import {
  getBackfillStatus,
  pauseBackfill,
  requestBackfillStart,
  resetBackfill,
  resumeBackfill,
} from "./lib/backfill";
import { searchNpmRegistry } from "./lib/clients/npm";
import { searchPackages as typesenseSearch } from "./lib/clients/typesense";
import { fetchPackageMetrics } from "./lib/metrics";
import { getReplacementStats, initReplacements } from "./lib/replacements";
import { getWeeklyDownloads } from "./tools/downloads";
import { getPackageHealth } from "./tools/health";
import {
  checkDeprecated,
  checkTypes,
  checkVulnerabilities,
  comparePackages,
  findAlternatives,
  getPackageVersion,
} from "./tools/index";
import { auth } from "./lib/auth";
import { db } from "./lib/db";
import { favorite, user as userTable } from "./lib/auth-schema";
import { eq, and } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";

const app = new Hono();
const PORT = process.env.PORT || 3001;

// Cache-Control headers for Cloudflare edge caching
const CACHE = {
  LONG: "public, s-maxage=86400, stale-while-revalidate=3600", // 24h + 1h stale
  MEDIUM: "public, s-maxage=21600, stale-while-revalidate=3600", // 6h + 1h stale
  SHORT: "public, s-maxage=3600, stale-while-revalidate=600", // 1h + 10min stale
  SEARCH: "public, s-maxage=300, stale-while-revalidate=60", // 5min + 1min stale
  NONE: "no-store",
};

// Initialize replacements at startup
initReplacements();
const replacementStats = getReplacementStats();
console.log(
  `[Startup] Loaded ${replacementStats.totalModules} modules (${replacementStats.nativeModules} native)`,
);

// Middleware
app.use("*", logger());
app.use(
  "*",
  cors({
    origin: (origin) => {
      // Allow localhost in development
      if (origin?.includes("localhost")) return origin;
      // Allow production domains
      if (origin?.endsWith(".v1.run") || origin === "https://v1.run") return origin;
      // Allow no origin (same-origin requests, curl, etc.)
      return origin || "*";
    },
    allowMethods: ["GET", "POST", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type"],
    credentials: true,
  }),
);

// Health check
app.get("/health", (c) => {
  return c.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    service: "v1-api",
  });
});

// Better Auth routes
if (auth) {
  const authHandler = auth.handler;
  app.on(["POST", "GET"], "/api/auth/*", async (c) => {
    const response = await authHandler(c.req.raw);
    // Prevent caching of auth responses
    response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
    response.headers.set("Pragma", "no-cache");
    return response;
  });
  console.log("[Auth] Better Auth routes mounted at /api/auth/*");
} else {
  console.log("[Auth] Skipped - DATABASE_URL not configured");
}

// Helper to get current user from session
async function getCurrentUser(c: { req: { raw: Request } }) {
  if (!auth) return null;
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  return session?.user || null;
}

// Favorites API endpoints (no caching - user-specific data)
app.get("/api/favorites", async (c) => {
  c.header("Cache-Control", "no-store, no-cache, must-revalidate");
  const user = await getCurrentUser(c);
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  if (!db) {
    return c.json({ error: "Database not configured" }, 500);
  }
  try {
    const favorites = await db
      .select()
      .from(favorite)
      .where(eq(favorite.userId, user.id))
      .orderBy(favorite.createdAt);
    return c.json({ favorites: favorites.map((f) => f.packageName) });
  } catch (error) {
    console.error("[Favorites] Error fetching:", error);
    return c.json({ error: "Failed to fetch favorites" }, 500);
  }
});

app.post("/api/favorites/:name", async (c) => {
  c.header("Cache-Control", "no-store");
  const user = await getCurrentUser(c);
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  if (!db) {
    return c.json({ error: "Database not configured" }, 500);
  }
  const packageName = decodeURIComponent(c.req.param("name"));
  try {
    await db
      .insert(favorite)
      .values({
        id: createId(),
        userId: user.id,
        packageName,
      })
      .onConflictDoNothing();
    return c.json({ success: true, packageName });
  } catch (error) {
    console.error("[Favorites] Error adding:", error);
    return c.json({ error: "Failed to add favorite" }, 500);
  }
});

app.delete("/api/favorites/:name", async (c) => {
  c.header("Cache-Control", "no-store");
  const user = await getCurrentUser(c);
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  if (!db) {
    return c.json({ error: "Database not configured" }, 500);
  }
  const packageName = decodeURIComponent(c.req.param("name"));
  try {
    await db
      .delete(favorite)
      .where(and(eq(favorite.userId, user.id), eq(favorite.packageName, packageName)));
    return c.json({ success: true, packageName });
  } catch (error) {
    console.error("[Favorites] Error removing:", error);
    return c.json({ error: "Failed to remove favorite" }, 500);
  }
});

app.get("/api/favorites/check/:name", async (c) => {
  c.header("Cache-Control", "no-store, no-cache, must-revalidate");
  const user = await getCurrentUser(c);
  if (!user) {
    return c.json({ isFavorite: false });
  }
  if (!db) {
    return c.json({ isFavorite: false });
  }
  const packageName = decodeURIComponent(c.req.param("name"));
  try {
    const result = await db
      .select()
      .from(favorite)
      .where(and(eq(favorite.userId, user.id), eq(favorite.packageName, packageName)))
      .limit(1);
    return c.json({ isFavorite: result.length > 0 });
  } catch (error) {
    return c.json({ isFavorite: false });
  }
});

// Delete user account
app.delete("/api/account", async (c) => {
  c.header("Cache-Control", "no-store");
  const currentUser = await getCurrentUser(c);
  if (!currentUser) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  if (!db) {
    return c.json({ error: "Database not configured" }, 500);
  }
  try {
    // Delete user - cascades to sessions, accounts, and favorites
    await db.delete(userTable).where(eq(userTable.id, currentUser.id));
    return c.json({ success: true });
  } catch (error) {
    console.error("[Account] Error deleting:", error);
    return c.json({ error: "Failed to delete account" }, 500);
  }
});

// Create MCP server with tools using the new registerTool API
function createMcpServer() {
  const server = new McpServer(
    {
      name: "v1-npm-tools",
      version: "1.0.0",
    },
    {
      capabilities: {
        tools: {},
      },
      instructions:
        "npm package tools for AI assistants. Use these to check package versions, deprecation status, TypeScript types, security vulnerabilities, and find alternatives.",
    },
  );

  // Register tools using the new registerTool API
  server.registerTool(
    "get_package_version",
    {
      title: "Get Package Version",
      description: "Get the latest version of an npm package",
      inputSchema: {
        name: z.string().describe("The npm package name (e.g., 'react', '@types/node')"),
      },
    },
    async ({ name }) => {
      try {
        const result = await getPackageVersion({ name });
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
            },
          ],
          isError: true,
        };
      }
    },
  );

  server.registerTool(
    "check_deprecated",
    {
      title: "Check Deprecated",
      description: "Check if a package is deprecated and get recommended alternatives",
      inputSchema: {
        name: z.string().describe("The npm package name to check"),
      },
    },
    async ({ name }) => {
      try {
        const result = await checkDeprecated({ name });
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
            },
          ],
          isError: true,
        };
      }
    },
  );

  server.registerTool(
    "check_types",
    {
      title: "Check TypeScript Types",
      description: "Check if a package has TypeScript types (bundled or via @types)",
      inputSchema: {
        name: z.string().describe("The npm package name to check for TypeScript types"),
      },
    },
    async ({ name }) => {
      try {
        const result = await checkTypes({ name });
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
            },
          ],
          isError: true,
        };
      }
    },
  );

  server.registerTool(
    "check_vulnerabilities",
    {
      title: "Check Vulnerabilities",
      description: "Check for known security vulnerabilities in a package version",
      inputSchema: {
        name: z.string().describe("The npm package name"),
        version: z.string().optional().describe("Specific version to check (defaults to latest)"),
      },
    },
    async ({ name, version }) => {
      try {
        const result = await checkVulnerabilities({ name, version });
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
            },
          ],
          isError: true,
        };
      }
    },
  );

  server.registerTool(
    "find_alternatives",
    {
      title: "Find Alternatives",
      description:
        "Find alternative packages with recommendations (useful for deprecated or outdated packages)",
      inputSchema: {
        name: z.string().describe("The npm package name to find alternatives for"),
      },
    },
    async ({ name }) => {
      try {
        const result = await findAlternatives({ name });
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
            },
          ],
          isError: true,
        };
      }
    },
  );

  server.registerTool(
    "compare_packages",
    {
      title: "Compare Packages",
      description:
        "Compare multiple npm packages side by side (downloads, types, ESM support, vulnerabilities)",
      inputSchema: {
        packages: z
          .array(z.string())
          .min(2)
          .max(5)
          .describe("Array of package names to compare (2-5 packages)"),
      },
    },
    async ({ packages }) => {
      try {
        const result = await comparePackages({ packages });
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
            },
          ],
          isError: true,
        };
      }
    },
  );

  // NEW: Comprehensive health tool - the primary tool for AI agents
  server.registerTool(
    "get_package_health",
    {
      title: "Get Package Health",
      description:
        "Get comprehensive package health assessment including security, quality, compatibility, popularity, alternatives, and AI recommendations. This is the primary tool for evaluating npm packages - returns everything in one call.",
      inputSchema: {
        name: z
          .string()
          .describe("The npm package name to analyze (e.g., 'lodash', 'express', '@types/react')"),
      },
    },
    async ({ name }) => {
      try {
        const result = await getPackageHealth(name);
        if (!result) {
          return {
            content: [{ type: "text", text: JSON.stringify({ error: "Package not found" }) }],
            isError: true,
          };
        }
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
            },
          ],
          isError: true,
        };
      }
    },
  );

  return server;
}

// Create MCP server and transport once (stateless mode for scalability)
const mcpServer = createMcpServer();
const mcpTransport = new WebStandardStreamableHTTPServerTransport({
  // Stateless mode - no session management needed
  // Each request is independent, making it easier to scale horizontally
  sessionIdGenerator: undefined,
});

// Connect server to transport on startup
mcpServer.connect(mcpTransport).then(() => {
  console.log("MCP server connected to transport");
});

// MCP endpoint - handles all MCP protocol communication
app.all("/mcp", async (c) => {
  return mcpTransport.handleRequest(c.req.raw);
});

// Search endpoint
app.get("/search", async (c) => {
  const query = c.req.query("q") || "";
  const page = Number.parseInt(c.req.query("page") || "1");
  const limit = Math.min(Number.parseInt(c.req.query("limit") || "20"), 100);

  if (!query.trim()) {
    return c.json({ hits: [], found: 0, page: 1 });
  }

  let hits: unknown[] = [];
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
    console.error("Typesense search failed, falling back to npm:", error);
  }

  // Fallback to npm search if Typesense failed or has few results (only on page 1)
  if (page === 1 && (!typesenseWorked || hits.length < 3)) {
    const npmResults = await searchNpmRegistry(query, limit);

    if (!typesenseWorked) {
      // Complete fallback - use npm results only
      hits = npmResults;
    } else {
      // Supplement sparse results - merge with deduplication
      const existingNames = new Set(hits.map((h) => (h as { name: string }).name));
      const newHits = npmResults.filter((r) => !existingNames.has(r.name));
      hits = [...hits, ...newHits].slice(0, limit);
    }
  }

  c.header("Cache-Control", CACHE.SEARCH);
  return c.json({
    hits,
    found: hits.length,
    page,
  });
});

// REST API endpoints (for non-MCP clients)
app.get("/api/package/:name/version", async (c) => {
  try {
    const name = decodeURIComponent(c.req.param("name"));
    const result = await getPackageVersion({ name });
    c.header("Cache-Control", CACHE.SHORT); // 1 hour
    return c.json(result);
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : "Unknown error" }, 404);
  }
});

app.get("/api/package/:name/deprecated", async (c) => {
  try {
    const name = decodeURIComponent(c.req.param("name"));
    const result = await checkDeprecated({ name });
    c.header("Cache-Control", CACHE.LONG); // 24 hours
    return c.json(result);
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : "Unknown error" }, 404);
  }
});

app.get("/api/package/:name/types", async (c) => {
  try {
    const name = decodeURIComponent(c.req.param("name"));
    const result = await checkTypes({ name });
    c.header("Cache-Control", CACHE.LONG); // 24 hours
    return c.json(result);
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : "Unknown error" }, 404);
  }
});

app.get("/api/package/:name/vulnerabilities", async (c) => {
  try {
    const name = decodeURIComponent(c.req.param("name"));
    const version = c.req.query("version");
    const result = await checkVulnerabilities({ name, version });
    c.header("Cache-Control", CACHE.MEDIUM); // 6 hours
    return c.json(result);
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : "Unknown error" }, 404);
  }
});

app.get("/api/package/:name/alternatives", async (c) => {
  try {
    const name = decodeURIComponent(c.req.param("name"));
    const result = await findAlternatives({ name });
    c.header("Cache-Control", CACHE.LONG); // 24 hours
    return c.json(result);
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : "Unknown error" }, 404);
  }
});

app.post("/api/compare", async (c) => {
  try {
    const body = await c.req.json();
    const result = await comparePackages({ packages: body.packages });
    // POST requests typically not cached, but we can cache the response
    c.header("Cache-Control", CACHE.SHORT); // 1 hour
    return c.json(result);
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : "Unknown error" }, 400);
  }
});

// Main package endpoint - comprehensive data
app.get("/api/package/:name", async (c) => {
  try {
    const name = decodeURIComponent(c.req.param("name"));
    const result = await getPackageHealth(name);
    if (!result) {
      return c.json({ error: "Package not found" }, 404);
    }
    c.header("Cache-Control", CACHE.LONG); // 24 hours
    return c.json(result);
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});

// Weekly downloads with sparkline data
app.get("/api/package/:name/downloads", async (c) => {
  try {
    const name = decodeURIComponent(c.req.param("name"));
    const weeks = Math.min(Number.parseInt(c.req.query("weeks") || "52"), 104);
    const result = await getWeeklyDownloads(name, weeks);
    if (!result) {
      return c.json({ error: "Package not found or no download data" }, 404);
    }
    c.header("Cache-Control", CACHE.MEDIUM); // 6 hours (downloads update daily)
    return c.json(result);
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});

// Compare endpoint - package comparisons and alternatives
// Cloudflare handles caching via Cache-Control headers
app.get("/api/compare", async (c) => {
  const packages = c.req.query("packages")?.split(",").filter(Boolean);
  const category = c.req.query("category");
  const packageName = c.req.query("package");
  const listCategories = c.req.query("list") === "categories";

  try {
    // List all available categories
    if (listCategories) {
      const categories: ExtendedCategory[] = SEED_CATEGORIES.map((cat) => ({
        ...cat,
        source: "seed" as const,
        confidence: 1,
      }));

      c.header("Cache-Control", CACHE.MEDIUM);
      return c.json({
        categories: categories.map((cat) => ({
          id: cat.id,
          name: cat.name,
          keywords: cat.keywords.slice(0, 5),
          source: cat.source,
          confidence: cat.confidence,
        })),
        curatedCount: CURATED_COMPARISONS.length,
        seedCategories: categories.length,
        discoveredCategories: 0,
        totalCategories: categories.length,
      });
    }

    // Get comparison for a specific category
    if (category) {
      const curated = getCuratedComparison(category);
      if (curated) {
        const comparison = await generateComparison(
          {
            category: curated.category,
            categoryName: curated.categoryName,
            packages: curated.packages,
            confidence: 1,
            discoveredVia: "manual",
          },
          fetchPackageMetrics,
        );

        if (comparison) {
          c.header("Cache-Control", CACHE.MEDIUM);
          return c.json(toApiResponse(comparison));
        }

        c.header("Cache-Control", CACHE.MEDIUM);
        return c.json(curated);
      }

      return c.json(
        { error: "Category not found. Use ?list=categories to see available categories." },
        404,
      );
    }

    // Find alternatives for a specific package
    if (packageName && !packages) {
      const metrics = await fetchPackageMetrics(packageName);
      if (!metrics) {
        return c.json({ error: "Package not found" }, 404);
      }

      const categoryId = inferCategory(metrics.keywords);
      if (!categoryId) {
        c.header("Cache-Control", CACHE.SHORT);
        return c.json({
          package: packageName,
          category: null,
          alternatives: [],
          message: "Could not determine package category from keywords",
        });
      }

      const curated = getCuratedComparison(categoryId);
      if (curated && curated.packages.includes(packageName)) {
        const comparison = await generateComparison(
          {
            category: curated.category,
            categoryName: curated.categoryName,
            packages: curated.packages,
            confidence: 1,
            discoveredVia: "manual",
          },
          fetchPackageMetrics,
        );

        if (comparison) {
          c.header("Cache-Control", CACHE.MEDIUM);
          return c.json({
            package: packageName,
            category: categoryId,
            categoryName: getCategoryName(categoryId),
            alternatives: comparison.packages
              .filter((p) => p.name !== packageName)
              .map((p) => ({
                name: p.name,
                score: p.score,
                badges: p.badges,
              })),
            comparison: toApiResponse(comparison),
          });
        }
      }

      c.header("Cache-Control", CACHE.SHORT);
      return c.json({
        package: packageName,
        category: categoryId,
        categoryName: getCategoryName(categoryId),
        alternatives: [],
        message: "No curated comparison available for this category yet",
      });
    }

    // Compare specific packages
    if (packages && packages.length >= 2) {
      const comparison = await compareSpecificPackages(packages, fetchPackageMetrics);

      if (!comparison) {
        return c.json({ error: "Could not fetch metrics for the requested packages" }, 400);
      }

      c.header("Cache-Control", CACHE.MEDIUM);
      return c.json(toApiResponse(comparison));
    }

    // Default: return usage info
    c.header("Cache-Control", CACHE.LONG);
    return c.json({
      message: "Package Comparison API",
      usage: {
        "List categories": "GET /api/compare?list=categories",
        "Get category comparison": "GET /api/compare?category=http-client",
        "Find alternatives": "GET /api/compare?package=axios",
        "Compare specific packages": "GET /api/compare?packages=axios,got,ky",
      },
      availableCategories: SEED_CATEGORIES.slice(0, 10).map((cat) => cat.id),
      seedCategories: SEED_CATEGORIES.length,
      totalCategories: SEED_CATEGORIES.length,
    });
  } catch (error) {
    console.error("Compare API error:", error);
    return c.json({ error: "Failed to generate comparison" }, 500);
  }
});

// =============================================================================
// Backfill Control Endpoints
// =============================================================================

// Get backfill status
app.get("/api/backfill/status", async (c) => {
  try {
    const status = await getBackfillStatus();
    c.header("Cache-Control", CACHE.NONE);
    return c.json(status);
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});

// Start a new backfill of the full npm registry
app.post("/api/backfill/start", async (c) => {
  try {
    const state = await requestBackfillStart();
    return c.json({
      message: "Backfill started. Worker will fetch all packages and begin processing.",
      state,
    });
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : "Unknown error" }, 400);
  }
});

// Pause backfill
app.post("/api/backfill/pause", async (c) => {
  try {
    const state = await pauseBackfill();
    return c.json({ message: "Backfill paused.", state });
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : "Unknown error" }, 400);
  }
});

// Resume backfill
app.post("/api/backfill/resume", async (c) => {
  try {
    const state = await resumeBackfill();
    return c.json({ message: "Backfill resumed.", state });
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : "Unknown error" }, 400);
  }
});

// Reset backfill
app.post("/api/backfill/reset", async (c) => {
  try {
    const state = await resetBackfill();
    return c.json({ message: "Backfill reset to idle.", state });
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : "Unknown error" }, 400);
  }
});

// =============================================================================
// Live Updates SSE Stream
// =============================================================================

interface NpmChange {
  seq: string;
  id: string;
  deleted?: boolean;
}

interface ChangesResponse {
  results: Array<{
    seq: number | string;
    id: string;
    deleted?: boolean;
    changes: Array<{ rev: string }>;
  }>;
  last_seq: number | string;
}

const NPM_REPLICATE_URL = "https://replicate.npmjs.com/registry";

async function fetchNpmChanges(
  since: string,
  limit = 100,
): Promise<{ changes: NpmChange[]; lastSeq: string }> {
  const url = `${NPM_REPLICATE_URL}/_changes?since=${since}&limit=${limit}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch changes: HTTP ${response.status}`);
  }

  const data = (await response.json()) as ChangesResponse;

  const changes: NpmChange[] = data.results
    .filter((result) => !result.id.startsWith("_design/"))
    .map((result) => ({
      seq: String(result.seq),
      id: result.id,
      deleted: result.deleted,
    }));

  return {
    changes,
    lastSeq: String(data.last_seq),
  };
}

async function getCurrentNpmSeq(): Promise<string> {
  const response = await fetch(`${NPM_REPLICATE_URL}/`);
  if (!response.ok) {
    throw new Error(`Failed to get registry info: ${response.status}`);
  }
  const data = (await response.json()) as { update_seq: string | number };
  return String(data.update_seq);
}

// SSE endpoint for live package updates
app.get("/api/updates/stream", async (c) => {
  const encoder = new TextEncoder();

  // Get initial sequence
  let currentSeq: string;
  try {
    currentSeq = await getCurrentNpmSeq();
  } catch {
    return c.json({ error: "Failed to connect to npm registry" }, 500);
  }

  const stream = new ReadableStream({
    start(controller) {
      let isRunning = true;

      // Send initial connection event
      controller.enqueue(
        encoder.encode(`event: connected\ndata: ${JSON.stringify({ seq: currentSeq })}\n\n`),
      );

      // Polling function
      const poll = async () => {
        while (isRunning) {
          try {
            const { changes, lastSeq } = await fetchNpmChanges(currentSeq, 25);

            for (const change of changes) {
              if (!isRunning) break;
              if (change.deleted) continue;

              const eventData = {
                name: change.id,
                seq: change.seq,
                timestamp: Date.now(),
              };

              controller.enqueue(
                encoder.encode(`event: package\ndata: ${JSON.stringify(eventData)}\n\n`),
              );
            }

            currentSeq = lastSeq;
            await new Promise((resolve) => setTimeout(resolve, 2000));
          } catch {
            controller.enqueue(
              encoder.encode(
                `event: error\ndata: ${JSON.stringify({ message: "Poll error" })}\n\n`,
              ),
            );
            await new Promise((resolve) => setTimeout(resolve, 5000));
          }
        }
      };

      // Keepalive ping
      const pingInterval = setInterval(() => {
        if (isRunning) {
          try {
            controller.enqueue(encoder.encode(`: ping\n\n`));
          } catch {
            isRunning = false;
            clearInterval(pingInterval);
          }
        }
      }, 15000);

      // Start polling in background
      poll().catch(() => {
        isRunning = false;
        clearInterval(pingInterval);
      });

      // Handle client disconnect
      c.req.raw.signal?.addEventListener("abort", () => {
        isRunning = false;
        clearInterval(pingInterval);
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-store, no-transform, must-revalidate",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
      // Cloudflare-specific: disable buffering
      "CF-Cache-Status": "DYNAMIC",
      // CORS
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Cache-Control",
      // Prevent chunked encoding issues
      "Transfer-Encoding": "chunked",
    },
  });
});

// Start server
console.log(`v1.run API server starting on port ${PORT}...`);
console.log(`  Health: http://localhost:${PORT}/health`);
console.log(`  MCP:    http://localhost:${PORT}/mcp`);
console.log(`  REST:   http://localhost:${PORT}/api/package/:name/version`);
console.log(`  Backfill: http://localhost:${PORT}/api/backfill/status`);

export default {
  port: PORT,
  fetch: app.fetch,
};
