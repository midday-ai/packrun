/**
 * MCP Handler
 *
 * Model Context Protocol endpoint for stateless operation.
 * Creates fresh server + transport per request to avoid conflicts
 * when multiple clients connect simultaneously.
 *
 * This endpoint should be served on a separate subdomain (e.g., mcp.packrun.dev)
 * that bypasses Cloudflare proxy to avoid SSE timeout issues.
 *
 * Note: Uses a minimal Hono app internally because @hono/mcp requires Hono context.
 */

import { StreamableHTTPTransport } from "@hono/mcp";
import { mcp as log } from "@packrun/logger";
import { Hono } from "hono";
import { createMcpServer } from "../mcp/server";

/**
 * Wrap SSE stream with keep-alive pings to prevent idle timeouts
 * Railway has a 5-minute HTTP timeout, but keep-alive helps with intermediate timeouts
 * Uses 15-second interval to prevent any proxy/router timeouts
 */
function addKeepAlive(stream: ReadableStream<Uint8Array>): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const reader = stream.getReader();
  let pingInterval: ReturnType<typeof setInterval> | null = null;
  let isStreamActive = true;

  return new ReadableStream({
    start(controller) {
      // Send keep-alive ping every 15 seconds
      pingInterval = setInterval(() => {
        if (isStreamActive) {
          try {
            // SSE comment (ping) - doesn't trigger events but keeps connection alive
            controller.enqueue(encoder.encode(`: keep-alive\n\n`));
          } catch {
            // Stream closed, stop pinging
            isStreamActive = false;
            if (pingInterval) clearInterval(pingInterval);
          }
        }
      }, 15000);

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
            // Forward original data
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

// Create a minimal Hono app for MCP (required by @hono/mcp)
const mcpApp = new Hono();

mcpApp.all("/mcp", async (c) => {
  try {
    // Create fresh server and transport per request to avoid conflicts
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
    log.error("Error handling request:", error);
    return c.json(
      {
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      500,
    );
  }
});

/**
 * Handle MCP request
 * Uses a minimal Hono app internally for @hono/mcp compatibility
 */
export async function handleMcp(request: Request): Promise<Response> {
  return mcpApp.fetch(request);
}
