/**
 * MCP Protocol Tests
 */

import { describe, expect, test } from "bun:test";
import {
  type McpInitializeResult,
  type McpToolsListResult,
  mcpRequest,
  mcpToolCall,
  request,
} from "./helpers";

describe("MCP Protocol", () => {
  test("initialize returns server info", async () => {
    const response = await mcpRequest<McpInitializeResult>("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "test", version: "1.0.0" },
    });

    expect(response.result?.serverInfo.name).toBe("packrun-npm-tools");
    expect(response.result?.capabilities.tools).toBeDefined();
  });

  test("tools/list returns all registered tools", async () => {
    const response = await mcpRequest<McpToolsListResult>("tools/list", {});

    expect(response.result?.tools.length).toBeGreaterThan(0);

    const toolNames = response.result?.tools.map((t) => t.name) ?? [];
    expect(toolNames).toContain("get_package_version");
    expect(toolNames).toContain("get_package_health");
    expect(toolNames).toContain("compare_packages");
    expect(toolNames).toContain("check_vulnerabilities");
    expect(toolNames).toContain("find_alternatives");
    expect(toolNames).toContain("audit_outdated_packages");
  });

  test("get_package_version returns version info", async () => {
    const result = await mcpToolCall<{ name: string; version: string }>("get_package_version", {
      name: "hono",
    });

    expect(result.name).toBe("hono");
    expect(result.version).toMatch(/^\d+\.\d+\.\d+/);
  });

  test("get_package_health returns comprehensive health data", async () => {
    const result = await mcpToolCall<{
      name: string;
      health: { score: number; grade: string };
      security: unknown;
    }>("get_package_health", { name: "zod" });

    expect(result.name).toBe("zod");
    expect(result.health.score).toBeGreaterThan(0);
    expect(result.health.grade).toMatch(/^[A-F]$/);
    expect(result.security).toBeDefined();
  });

  test("compare_packages returns comparison data", async () => {
    const result = await mcpToolCall<{ packages: Array<{ name: string }> }>("compare_packages", {
      packages: ["axios", "got"],
    });

    expect(result.packages).toHaveLength(2);
  });

  test("request without Accept header returns error", async () => {
    const res = await request("/mcp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {},
      }),
    });

    const data = (await res.json()) as { error: unknown };
    expect(data.error).toBeDefined();
  });
});
