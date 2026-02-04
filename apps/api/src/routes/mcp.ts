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

    // Clone response with Cloudflare-compatible headers
    const headers = new Headers(response.headers);

    // Ensure Content-Type is set for SSE (StreamableHTTPTransport uses SSE for streaming)
    const contentType = headers.get("Content-Type");
    if (!contentType || !contentType.includes("event-stream")) {
      headers.set("Content-Type", "text/event-stream");
    }

    // Prevent Cloudflare from caching/buffering the streaming connection
    // Note: Cloudflare doesn't cache POST requests by default anyway
    // We rely on in-memory LRU cache in tool functions for fast responses
    headers.set("Cache-Control", "no-cache, no-store, no-transform, must-revalidate");
    headers.set("Connection", "keep-alive");
    headers.set("X-Accel-Buffering", "no"); // Disable nginx/proxy buffering
    headers.set("CF-Cache-Status", "DYNAMIC"); // Tell Cloudflare not to cache

    // Ensure Transfer-Encoding is chunked for streaming (matches SSE endpoint)
    if (!headers.has("Transfer-Encoding")) {
      headers.set("Transfer-Encoding", "chunked");
    }

    // Ensure CORS headers are set for MCP clients
    if (!headers.has("Access-Control-Allow-Origin")) {
      headers.set("Access-Control-Allow-Origin", "*");
    }
    if (!headers.has("Access-Control-Allow-Headers")) {
      headers.set("Access-Control-Allow-Headers", "Content-Type, Cache-Control");
    }

    // Return new response with modified headers and same body
    return new Response(response.body ?? null, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  });

  return app;
}
