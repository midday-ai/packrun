/**
 * MCP Route
 *
 * Model Context Protocol endpoint for stateless operation.
 * Creates fresh server + transport per request to avoid conflicts
 * when multiple clients connect simultaneously.
 *
 * This endpoint should be served on a separate subdomain (e.g., mcp.v1.run)
 * that bypasses Cloudflare proxy to avoid SSE timeout issues.
 * See CLOUDFLARE_MCP_FIX.md for setup instructions.
 *
 * Reliability improvements:
 * - Keep-alive pings every 30 seconds to prevent idle timeouts
 * - Better error handling and connection management
 * - Railway 5-minute timeout awareness
 */

import { Hono } from "hono";
import { StreamableHTTPTransport } from "@hono/mcp";
import { createMcpServer } from "../mcp/server";

/**
 * Wrap SSE stream with keep-alive pings to prevent idle timeouts
 * Railway has a 5-minute HTTP timeout, but keep-alive helps with intermediate timeouts
 *
 * Uses ReadableStream with manual forwarding for better control
 */
function addKeepAlive(stream: ReadableStream<Uint8Array>): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const reader = stream.getReader();
  let lastActivity = Date.now();
  let pingInterval: ReturnType<typeof setInterval> | null = null;
  let isStreamActive = true;

  return new ReadableStream({
    start(controller) {
      // Send keep-alive ping every 30 seconds during idle periods
      pingInterval = setInterval(() => {
        if (isStreamActive && Date.now() - lastActivity > 25000) {
          // Only ping if no activity in last 25 seconds (to avoid pinging during active communication)
          try {
            // SSE comment (ping) - doesn't trigger events but keeps connection alive
            controller.enqueue(encoder.encode(`: keep-alive\n\n`));
          } catch {
            // Stream closed, stop pinging
            isStreamActive = false;
            if (pingInterval) clearInterval(pingInterval);
          }
        }
      }, 30000); // Check every 30 seconds

      // Forward original stream data
      const pump = async () => {
        try {
          while (isStreamActive) {
            const { done, value } = await reader.read();
            if (done) {
              isStreamActive = false;
              if (pingInterval) clearInterval(pingInterval);
              controller.close();
              break;
            }
            // Update activity timestamp when we receive data
            lastActivity = Date.now();
            controller.enqueue(value);
          }
        } catch (error) {
          isStreamActive = false;
          if (pingInterval) clearInterval(pingInterval);
          controller.error(error);
        }
      };

      pump();
    },
    cancel() {
      // Cleanup on cancellation
      isStreamActive = false;
      if (pingInterval) clearInterval(pingInterval);
      reader.cancel().catch(() => {
        // Ignore cancel errors
      });
    },
  });
}

export function createMcpRoutes() {
  const app = new Hono();

  app.all("/mcp", async (c) => {
    try {
      // Create fresh server and transport per request to avoid conflicts
      // This ensures clean state for each request and prevents connection state corruption
      const mcpServer = createMcpServer();
      const transport = new StreamableHTTPTransport();

      await mcpServer.connect(transport);

      // Handle the request through the transport
      const response = await transport.handleRequest(c);

      if (!response) {
        return c.json({ error: "Failed to handle MCP request" }, 500);
      }

      // Add SSE headers for reliability
      const headers = new Headers(response.headers);
      headers.set("Content-Type", "text/event-stream");
      headers.set("Cache-Control", "no-cache, no-store, must-revalidate");
      headers.set("Connection", "keep-alive");
      headers.set("Access-Control-Allow-Origin", "*");
      headers.set("X-Accel-Buffering", "no"); // Prevent proxy buffering

      // Wrap stream with keep-alive if it's a readable stream
      const body = response.body ? addKeepAlive(response.body as ReadableStream<Uint8Array>) : null;

      return new Response(body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    } catch (error) {
      console.error("[MCP] Error handling request:", error);
      return c.json(
        {
          error: "Internal server error",
          message: error instanceof Error ? error.message : "Unknown error",
        },
        500,
      );
    }
  });

  return app;
}
