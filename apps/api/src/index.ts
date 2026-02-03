/**
 * v1.run API Server
 *
 * Hono server with OpenAPI spec and MCP (Model Context Protocol) support for AI agents
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { OpenAPIHono } from "@hono/zod-openapi";
import { apiReference } from "@scalar/hono-api-reference";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { z } from "zod";
import { getReplacementStats, initReplacements } from "./lib/replacements";
import { auth } from "./lib/auth";

// Import route creators
import {
  createPackageRoutes,
  createCompareRoutes,
  createFavoritesRoutes,
  createAdminRoutes,
} from "./routes/index";

// Import MCP tools
import {
  auditOutdatedPackages,
  checkDeprecated,
  checkTypes,
  checkVersionHealth,
  checkVulnerabilities,
  comparePackages,
  findAlternatives,
  getLatestWithHealth,
  getPackageVersion,
  suggestLatestForCategory,
} from "./tools/index";
import { getPackageHealth } from "./tools/health";

const app = new OpenAPIHono();
const PORT = process.env.PORT || 3001;

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
    allowHeaders: ["Content-Type", "Cache-Control"],
    credentials: true,
  }),
);

// =============================================================================
// Mount OpenAPI Routes
// =============================================================================

// Admin routes (health check, backfill)
app.route("/", createAdminRoutes());

// Package routes
app.route("/", createPackageRoutes());

// Compare and search routes
app.route("/", createCompareRoutes());

// Favorites routes (authenticated)
app.route("/", createFavoritesRoutes());

// =============================================================================
// OpenAPI Spec & Scalar Documentation
// =============================================================================

app.doc("/openapi.json", {
  openapi: "3.1.0",
  info: {
    title: "v1.run API",
    version: "1.0.0",
    description:
      "npm package intelligence API - Get health scores, security assessments, and recommendations for npm packages",
    contact: {
      name: "v1.run",
      url: "https://v1.run",
    },
  },
  servers: [
    {
      url: "https://api.v1.run",
      description: "Production",
    },
    {
      url: "http://localhost:3001",
      description: "Development",
    },
  ],
  tags: [
    { name: "Package", description: "Package information and health assessment" },
    { name: "Compare", description: "Package comparison and alternatives" },
    { name: "Search", description: "Package search" },
    { name: "Favorites", description: "User favorites management" },
    { name: "Account", description: "User account management" },
  ],
});

app.get(
  "/docs",
  apiReference({
    url: "/openapi.json",
    theme: "kepler",
    layout: "modern",
    defaultHttpClient: {
      targetKey: "js",
      clientKey: "fetch",
    },
  }),
);

// =============================================================================
// Better Auth Routes
// =============================================================================

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

// =============================================================================
// MCP Server Setup
// =============================================================================

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
        "npm package tools for AI assistants. Use these tools whenever the user mentions npm packages, asks about choosing between packages, comparing frameworks, or making package decisions. Always use latest versions. Tools check package versions, health scores, security vulnerabilities, and provide upgrade recommendations. When users ask 'should I use X or Y?', 'which package is better?', or 'compare X and Y', use compare_packages or get_package_health to provide data-driven recommendations. Focus on ensuring packages are up-to-date, secure, and well-maintained.",
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
        "Compare multiple npm packages side by side (downloads, types, ESM support, vulnerabilities). Use this tool when users ask 'should I use X or Y?', 'which is better?', 'compare X and Y', or any question about choosing between packages. Essential for framework/library selection questions.",
      inputSchema: {
        packages: z
          .array(z.string())
          .min(2)
          .max(5)
          .describe(
            "Array of package names to compare (2-5 packages). Use when user mentions multiple packages or asks comparison questions.",
          ),
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
        "Get comprehensive package health assessment including security, quality, compatibility, popularity, alternatives, and AI recommendations. This is the primary tool for evaluating npm packages - returns everything in one call. Use when users ask about a specific package, want to evaluate a package, or need detailed information for decision-making.",
      inputSchema: {
        name: z
          .string()
          .describe(
            "The npm package name to analyze (e.g., 'lodash', 'express', '@types/react'). Use whenever a package name is mentioned in the conversation.",
          ),
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

  // Version health checker tool
  server.registerTool(
    "check_version_health",
    {
      title: "Check Version Health",
      description:
        "Check if a specific package version is latest, secure, and well-maintained. Compares current version against latest and provides upgrade recommendations.",
      inputSchema: {
        name: z.string().describe("The npm package name"),
        version: z
          .string()
          .optional()
          .describe("Current version to check (if not provided, checks latest version)"),
        checkLatest: z
          .boolean()
          .optional()
          .default(true)
          .describe("Whether to compare against latest version"),
      },
    },
    async ({ name, version, checkLatest }) => {
      try {
        const result = await checkVersionHealth({ name, version, checkLatest });
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

  // Get latest with health tool
  server.registerTool(
    "get_latest_with_health",
    {
      title: "Get Latest Version with Health",
      description:
        "Always get the latest version of a package with comprehensive health check, security status, and safety assessment. Ensures you're using the best version.",
      inputSchema: {
        name: z.string().describe("The npm package name"),
        includeAlternatives: z
          .boolean()
          .optional()
          .default(false)
          .describe("Include alternative package recommendations"),
      },
    },
    async ({ name, includeAlternatives }) => {
      try {
        const result = await getLatestWithHealth({ name, includeAlternatives });
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

  // Audit outdated packages tool
  server.registerTool(
    "audit_outdated_packages",
    {
      title: "Audit Outdated Packages",
      description:
        "Analyze package.json to find outdated packages, security vulnerabilities, and prioritize upgrades. Returns comprehensive audit with actionable recommendations.",
      inputSchema: {
        packageJson: z
          .string()
          .or(z.record(z.string(), z.unknown()))
          .describe("package.json content as string or parsed object"),
        includeDevDependencies: z
          .boolean()
          .optional()
          .default(false)
          .describe("Check devDependencies too"),
        minSeverity: z
          .enum(["low", "moderate", "high", "critical"])
          .optional()
          .default("low")
          .describe("Minimum severity to report"),
      },
    },
    async ({ packageJson, includeDevDependencies, minSeverity }) => {
      try {
        const result = await auditOutdatedPackages({
          packageJson,
          includeDevDependencies,
          minSeverity,
        });
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

  // Suggest latest for category tool
  server.registerTool(
    "suggest_latest_for_category",
    {
      title: "Suggest Latest Packages for Category",
      description:
        "Get latest versions of top packages in a category with health scores and recommendations. Always returns latest versions with safety assessment.",
      inputSchema: {
        category: z
          .string()
          .describe("Category ID (e.g., 'http-client', 'date-library', 'validation')"),
        limit: z
          .number()
          .min(1)
          .max(10)
          .optional()
          .default(5)
          .describe("Number of packages to return (1-10)"),
        minHealthScore: z
          .number()
          .min(0)
          .max(100)
          .optional()
          .default(60)
          .describe("Minimum health score (0-100)"),
      },
    },
    async ({ category, limit, minHealthScore }) => {
      try {
        const result = await suggestLatestForCategory({ category, limit, minHealthScore });
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
console.log(`  Docs:   http://localhost:${PORT}/docs`);
console.log(`  OpenAPI: http://localhost:${PORT}/openapi.json`);
console.log(`  MCP:    http://localhost:${PORT}/mcp`);
console.log(`  REST:   http://localhost:${PORT}/api/package/:name`);

export default {
  port: PORT,
  fetch: app.fetch,
};
