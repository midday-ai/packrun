/**
 * v1.run API Server
 *
 * Hono server with MCP (Model Context Protocol) support for AI agents
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { z } from "zod";
import { getReplacementStats, initReplacements } from "./lib/replacements";
import { getPackageHealth } from "./tools/health";
import {
  checkDeprecated,
  checkTypes,
  checkVulnerabilities,
  comparePackages,
  findAlternatives,
  getPackageVersion,
} from "./tools/index";

const app = new Hono();
const PORT = process.env.PORT || 3001;

// Initialize replacements at startup
initReplacements();
const replacementStats = getReplacementStats();
console.log(
  `[Startup] Loaded ${replacementStats.totalModules} modules with ${replacementStats.totalReplacements} replacements`,
);

// Middleware
app.use("*", logger());
app.use("*", cors());

// Health check
app.get("/health", (c) => {
  return c.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    service: "v1-api",
  });
});

// Create MCP server with tools using the new registerTool API
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
        "npm package tools for AI assistants. Use these to check package versions, deprecation status, TypeScript types, security vulnerabilities, and find alternatives.",
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
        "Compare multiple npm packages side by side (downloads, types, ESM support, vulnerabilities)",
      inputSchema: {
        packages: z
          .array(z.string())
          .min(2)
          .max(5)
          .describe("Array of package names to compare (2-5 packages)"),
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
        "Get comprehensive package health assessment including security, quality, compatibility, popularity, alternatives, and AI recommendations. This is the primary tool for evaluating npm packages - returns everything in one call.",
      inputSchema: {
        name: z
          .string()
          .describe("The npm package name to analyze (e.g., 'lodash', 'express', '@types/react')"),
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

// REST API endpoints (for non-MCP clients)
app.get("/api/package/:name/version", async (c) => {
  try {
    const name = decodeURIComponent(c.req.param("name"));
    const result = await getPackageVersion({ name });
    return c.json(result);
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : "Unknown error" }, 404);
  }
});

app.get("/api/package/:name/deprecated", async (c) => {
  try {
    const name = decodeURIComponent(c.req.param("name"));
    const result = await checkDeprecated({ name });
    return c.json(result);
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : "Unknown error" }, 404);
  }
});

app.get("/api/package/:name/types", async (c) => {
  try {
    const name = decodeURIComponent(c.req.param("name"));
    const result = await checkTypes({ name });
    return c.json(result);
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : "Unknown error" }, 404);
  }
});

app.get("/api/package/:name/vulnerabilities", async (c) => {
  try {
    const name = decodeURIComponent(c.req.param("name"));
    const version = c.req.query("version");
    const result = await checkVulnerabilities({ name, version });
    return c.json(result);
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : "Unknown error" }, 404);
  }
});

app.get("/api/package/:name/alternatives", async (c) => {
  try {
    const name = decodeURIComponent(c.req.param("name"));
    const result = await findAlternatives({ name });
    return c.json(result);
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : "Unknown error" }, 404);
  }
});

app.post("/api/compare", async (c) => {
  try {
    const body = await c.req.json();
    const result = await comparePackages({ packages: body.packages });
    return c.json(result);
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : "Unknown error" }, 400);
  }
});

app.get("/api/package/:name/health", async (c) => {
  try {
    const name = decodeURIComponent(c.req.param("name"));
    const result = await getPackageHealth(name);
    if (!result) {
      return c.json({ error: "Package not found" }, 404);
    }
    return c.json(result);
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});

// Start server
console.log(`v1.run API server starting on port ${PORT}...`);
console.log(`  Health: http://localhost:${PORT}/health`);
console.log(`  MCP:    http://localhost:${PORT}/mcp`);
console.log(`  REST:   http://localhost:${PORT}/api/package/:name/version`);

export default {
  port: PORT,
  fetch: app.fetch,
};
