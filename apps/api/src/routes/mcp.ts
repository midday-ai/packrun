/**
 * MCP Route
 *
 * Model Context Protocol endpoint for stateless operation.
 * Creates fresh server + transport per request to avoid conflicts
 * when multiple clients connect simultaneously.
 */

import { Hono } from "hono";
import { StreamableHTTPTransport } from "@hono/mcp";
import { createMcpServer } from "../mcp/server";

export function createMcpRoutes() {
  const app = new Hono();

  app.all("/mcp", async (c) => {
    // Create fresh server and transport per request to avoid conflicts
    const mcpServer = createMcpServer();
    const transport = new StreamableHTTPTransport();

    await mcpServer.connect(transport);

    // Get the response from the transport (don't read request body here - transport needs it)
    const response = await transport.handleRequest(c);

    if (!response) {
      return c.json({ error: "Failed to handle MCP request" }, 500);
    }

    // Clone response with Cloudflare-compatible headers for SSE streaming
    // These headers match the working /api/updates/stream endpoint exactly
    const headers = new Headers(response.headers);

    // Ensure Content-Type is set for SSE (StreamableHTTPTransport uses SSE for streaming)
    headers.set("Content-Type", "text/event-stream");

    // Critical: Prevent Cloudflare from buffering/caching SSE streams
    // These headers MUST be set to prevent Bad Gateway errors
    headers.set("Cache-Control", "no-cache, no-store, no-transform, must-revalidate");
    headers.set("Connection", "keep-alive");
    headers.set("X-Accel-Buffering", "no"); // Disable nginx/proxy buffering
    headers.set("CF-Cache-Status", "DYNAMIC"); // Tell Cloudflare not to cache
    headers.set("Transfer-Encoding", "chunked"); // Ensure chunked transfer

    // CORS headers for MCP clients (matches SSE endpoint)
    headers.set("Access-Control-Allow-Origin", "*");
    headers.set("Access-Control-Allow-Headers", "Cache-Control");

    // Return new response with modified headers and same body
    return new Response(response.body ?? null, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  });

  return app;
}
