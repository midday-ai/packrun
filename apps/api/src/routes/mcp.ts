/**
 * MCP Route
 *
 * Model Context Protocol endpoint using @hono/mcp for stateless operation.
 * See: https://honohub.dev/docs/hono-mcp/stateless
 */

import { Hono } from "hono";
import { StreamableHTTPTransport } from "@hono/mcp";
import { createMcpServer } from "../mcp/server";

// Create server and transport once (stateless mode)
const mcpServer = createMcpServer();
const transport = new StreamableHTTPTransport();

export function createMcpRoutes() {
  const app = new Hono();

  app.all("/mcp", async (c) => {
    // Connect if not already connected
    if (!mcpServer.isConnected()) {
      await mcpServer.connect(transport);
    }

    return transport.handleRequest(c);
  });

  return app;
}
