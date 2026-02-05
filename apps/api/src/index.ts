/**
 * packrun.dev API Server
 *
 * Bun server with oRPC for type-safe RPC and OpenAPI endpoints.
 * Special handlers for SSE streaming, MCP, and unsubscribe pages.
 */

import { colors, api as log } from "@packrun/logger";
import { handleMcp, handleUnsubscribe, handleUpdatesStream } from "./handlers";
import { auth } from "./lib/auth";
import { getReplacementStats, initReplacements } from "./lib/replacements";
import { handleOpenAPI, handleRPC } from "./orpc-handler";

// =============================================================================
// Initialization
// =============================================================================

const PORT = process.env.PORT || 3001;

// Initialize replacements data
initReplacements();
const replacementStats = getReplacementStats();
log.ready(
  `Loaded ${replacementStats.totalModules} modules (${replacementStats.nativeModules} native)`,
);

// =============================================================================
// CORS Helper
// =============================================================================

function getCorsHeaders(origin: string | null): Record<string, string> {
  let allowOrigin = "*";
  if (origin?.includes("localhost")) {
    allowOrigin = origin;
  } else if (origin?.endsWith(".packrun.dev") || origin === "https://packrun.dev") {
    allowOrigin = origin;
  }

  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "GET, HEAD, PUT, POST, DELETE, PATCH, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Cache-Control, Authorization",
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Max-Age": "86400",
  };
}

/**
 * Add CORS headers to a response
 */
function withCors(response: Response, origin: string | null): Response {
  const corsHeaders = getCorsHeaders(origin);
  for (const [key, value] of Object.entries(corsHeaders)) {
    response.headers.set(key, value);
  }
  return response;
}

// =============================================================================
// Request Handler
// =============================================================================

async function handleRequest(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const origin = request.headers.get("origin");

  // Handle CORS preflight
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: getCorsHeaders(origin),
    });
  }

  // Route the request and add CORS headers to response
  const response = await routeRequest(request, url);
  return withCors(response, origin);
}

/**
 * Route request to appropriate handler
 */
async function routeRequest(request: Request, url: URL): Promise<Response> {
  // ==========================================================================
  // Special Handlers (non-oRPC)
  // ==========================================================================

  // MCP endpoint (uses Hono internally for @hono/mcp)
  if (url.pathname === "/mcp") {
    return handleMcp(request);
  }

  // Updates SSE stream
  if (url.pathname === "/v1/updates/stream") {
    return handleUpdatesStream(request);
  }

  // Unsubscribe HTML pages
  if (url.pathname === "/v1/unsubscribe") {
    return handleUnsubscribe(request);
  }

  // ==========================================================================
  // Better Auth
  // ==========================================================================

  if (url.pathname.startsWith("/v1/auth/") && auth) {
    const response = await auth.handler(request);
    response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
    response.headers.set("Pragma", "no-cache");
    return response;
  }

  // ==========================================================================
  // oRPC Handlers
  // ==========================================================================

  // RPC endpoint (type-safe internal clients)
  if (url.pathname.startsWith("/rpc")) {
    const response = await handleRPC(request);
    if (response) {
      return response;
    }
  }

  // OpenAPI endpoint (REST consumers)
  // Matches /v1/*, /search, /docs, /openapi.json
  if (
    url.pathname.startsWith("/v1/") ||
    url.pathname === "/search" ||
    url.pathname === "/docs" ||
    url.pathname === "/openapi.json"
  ) {
    const response = await handleOpenAPI(request);
    if (response) {
      return response;
    }
  }

  // ==========================================================================
  // Health check (for backwards compatibility)
  // ==========================================================================

  if (url.pathname === "/health") {
    return new Response(
      JSON.stringify({
        status: "healthy",
        timestamp: new Date().toISOString(),
        service: "packrun-api",
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  // ==========================================================================
  // Not Found
  // ==========================================================================

  return new Response(
    JSON.stringify({
      error: "Not Found",
      path: url.pathname,
    }),
    {
      status: 404,
      headers: { "Content-Type": "application/json" },
    },
  );
}

// =============================================================================
// Server Startup
// =============================================================================

const c = colors;
const endpoints = [
  `${c.cyan("Docs")}    ${c.gray("→")} ${c.whiteBright(`http://localhost:${PORT}/docs`)}`,
  `${c.green("Health")}  ${c.gray("→")} ${c.whiteBright(`http://localhost:${PORT}/health`)}`,
  `${c.magenta("MCP")}     ${c.gray("→")} ${c.whiteBright(`http://localhost:${PORT}/mcp`)}`,
  `${c.blue("RPC")}     ${c.gray("→")} ${c.whiteBright(`http://localhost:${PORT}/rpc`)}`,
  `${c.yellow("REST")}    ${c.gray("→")} ${c.whiteBright(`http://localhost:${PORT}/v1/*`)}`,
];
if (auth) {
  endpoints.push(
    `${c.red("Auth")}    ${c.gray("→")} ${c.whiteBright(`http://localhost:${PORT}/v1/auth/*`)}`,
  );
}

log.box({
  title: c.bold(`packrun.dev API :${PORT}`),
  message: endpoints.join("\n"),
});

export default {
  port: PORT,
  fetch: handleRequest,
};
