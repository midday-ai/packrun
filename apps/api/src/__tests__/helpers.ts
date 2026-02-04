/**
 * Shared test utilities and types
 */

import app from "../index";

// =============================================================================
// Types
// =============================================================================

export interface McpResponse<T = unknown> {
  jsonrpc: "2.0";
  id: number;
  result?: T;
  error?: { code: number; message: string };
}

export interface McpToolsListResult {
  tools: Array<{ name: string; description: string }>;
}

export interface McpToolCallResult {
  content: Array<{ type: string; text: string }>;
}

export interface McpInitializeResult {
  serverInfo: { name: string; version: string };
  capabilities: { tools: unknown };
}

// =============================================================================
// HTTP Helpers
// =============================================================================

/**
 * Make a request to the app
 */
export async function request(path: string, options?: RequestInit): Promise<Response> {
  return app.fetch(new Request(`http://localhost${path}`, options));
}

// =============================================================================
// MCP Helpers
// =============================================================================

/**
 * Parse SSE response to get JSON data
 */
export function parseSSE<T>(text: string): T {
  const dataLine = text.split("\n").find((line) => line.startsWith("data: "));
  if (!dataLine) throw new Error(`No data line in SSE response: ${text}`);
  return JSON.parse(dataLine.slice(6)) as T;
}

/**
 * Make an MCP JSON-RPC request
 */
export async function mcpRequest<T>(method: string, params: unknown = {}): Promise<McpResponse<T>> {
  const res = await request("/mcp", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method,
      params,
    }),
  });

  const text = await res.text();
  return parseSSE<McpResponse<T>>(text);
}

/**
 * Call an MCP tool and parse the result
 */
export async function mcpToolCall<T>(toolName: string, args: unknown): Promise<T> {
  const response = await mcpRequest<McpToolCallResult>("tools/call", {
    name: toolName,
    arguments: args,
  });

  if (response.error) {
    throw new Error(`MCP error: ${response.error.message}`);
  }

  const content = response.result?.content?.[0];
  if (!content?.text) {
    throw new Error("No content in tool response");
  }

  return JSON.parse(content.text) as T;
}
