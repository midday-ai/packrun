/**
 * v1.run API Server
 *
 * Hono server with OpenAPI spec and MCP support for AI agents.
 */

import { OpenAPIHono } from "@hono/zod-openapi";
import { apiReference } from "@scalar/hono-api-reference";
import { cors } from "hono/cors";
import { logger } from "hono/logger";

import { auth } from "./lib/auth";
import { getReplacementStats, initReplacements } from "./lib/replacements";
import {
  createAdminRoutes,
  createCompareRoutes,
  createFavoritesRoutes,
  createMcpRoutes,
  createPackageRoutes,
  createUpdatesRoutes,
} from "./routes/index";

// =============================================================================
// App Setup
// =============================================================================

const app = new OpenAPIHono();
const PORT = process.env.PORT || 3001;

// Initialize replacements data
initReplacements();
const replacementStats = getReplacementStats();
console.log(
  `[Startup] Loaded ${replacementStats.totalModules} modules (${replacementStats.nativeModules} native)`,
);

// =============================================================================
// Middleware
// =============================================================================

app.use("*", logger());
app.use(
  "*",
  cors({
    origin: (origin) => {
      if (origin?.includes("localhost")) return origin;
      if (origin?.endsWith(".v1.run") || origin === "https://v1.run") return origin;
      return origin || "*";
    },
    allowMethods: ["GET", "POST", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Cache-Control"],
    credentials: true,
  }),
);

// =============================================================================
// Routes
// =============================================================================

// Admin (health check)
app.route("/", createAdminRoutes());

// Package routes
app.route("/", createPackageRoutes());

// Compare and search routes
app.route("/", createCompareRoutes());

// Favorites routes (authenticated)
app.route("/", createFavoritesRoutes());

// MCP endpoint
app.route("/", createMcpRoutes());

// Live updates SSE stream
app.route("/", createUpdatesRoutes());

// =============================================================================
// OpenAPI Documentation
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
    { url: "https://api.v1.run", description: "Production" },
    { url: "http://localhost:3001", description: "Development" },
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
    response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
    response.headers.set("Pragma", "no-cache");
    return response;
  });
  console.log("[Auth] Better Auth routes mounted at /api/auth/*");
} else {
  console.log("[Auth] Skipped - DATABASE_URL not configured");
}

// =============================================================================
// Server Startup
// =============================================================================

console.log(`v1.run API server starting on port ${PORT}...`);
console.log(`  Health:  http://localhost:${PORT}/health`);
console.log(`  Docs:    http://localhost:${PORT}/docs`);
console.log(`  OpenAPI: http://localhost:${PORT}/openapi.json`);
console.log(`  MCP:     http://localhost:${PORT}/mcp`);
console.log(`  REST:    http://localhost:${PORT}/api/package/:name`);

export default {
  port: PORT,
  fetch: app.fetch,
};
