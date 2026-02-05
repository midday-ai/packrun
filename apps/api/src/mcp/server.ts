/**
 * MCP Server Configuration
 *
 * Creates and configures the MCP server with all available tools.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  auditOutdatedPackages,
  checkDeprecated,
  checkTypes,
  checkVersionHealth,
  checkVulnerabilities,
  comparePackages,
  findAlternatives,
  getLatestWithHealth,
  getPackageVersion,
  suggestLatestForCategory,
} from "../tools";
import { getPackageHealth } from "../tools/health";

/**
 * Create a configured MCP server with all npm tools registered
 */
export function createMcpServer(): McpServer {
  const server = new McpServer(
    {
      name: "packrun-npm-tools",
      version: "1.0.0",
    },
    {
      capabilities: {
        tools: {},
      },
      instructions:
        "npm package tools for AI assistants. Use these tools whenever the user mentions npm packages, asks about choosing between packages, comparing frameworks, or making package decisions. Always use latest versions. Tools check package versions, health scores, security vulnerabilities, and provide upgrade recommendations. When users ask 'should I use X or Y?', 'which package is better?', or 'compare X and Y', use compare_packages or get_package_health to provide data-driven recommendations. Focus on ensuring packages are up-to-date, secure, and well-maintained.",
    },
  );

  // Register all tools
  registerTools(server);

  return server;
}

/**
 * Helper to create a tool result
 */
function toolResult(data: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
  };
}

/**
 * Helper to create an error result
 */
function errorResult(error: unknown) {
  return {
    content: [
      {
        type: "text" as const,
        text: `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
      },
    ],
    isError: true,
  };
}

/**
 * Register all MCP tools on the server
 */
function registerTools(server: McpServer): void {
  // get_package_version
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
        return toolResult(await getPackageVersion({ name }));
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  // check_deprecated
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
        return toolResult(await checkDeprecated({ name }));
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  // check_types
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
        return toolResult(await checkTypes({ name }));
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  // check_vulnerabilities
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
        return toolResult(await checkVulnerabilities({ name, version }));
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  // find_alternatives
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
        return toolResult(await findAlternatives({ name }));
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  // compare_packages
  server.registerTool(
    "compare_packages",
    {
      title: "Compare Packages",
      description:
        "Compare multiple npm packages side by side (downloads, types, ESM support, vulnerabilities). Use this tool when users ask 'should I use X or Y?', 'which is better?', 'compare X and Y', or any question about choosing between packages.",
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
        return toolResult(await comparePackages({ packages }));
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  // get_package_health - Primary tool for AI agents
  server.registerTool(
    "get_package_health",
    {
      title: "Get Package Health",
      description:
        "Get comprehensive package health assessment including security, quality, compatibility, popularity, alternatives, and AI recommendations. This is the primary tool for evaluating npm packages.",
      inputSchema: {
        name: z.string().describe("The npm package name to analyze"),
      },
    },
    async ({ name }) => {
      try {
        const result = await getPackageHealth(name);
        if (!result) {
          return {
            content: [{ type: "text" as const, text: '{"error":"Package not found"}' }],
            isError: true,
          };
        }
        return toolResult(result);
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  // check_version_health
  server.registerTool(
    "check_version_health",
    {
      title: "Check Version Health",
      description:
        "Check if a specific package version is latest, secure, and well-maintained. Compares current version against latest and provides upgrade recommendations.",
      inputSchema: {
        name: z.string().describe("The npm package name"),
        version: z.string().optional().describe("Current version to check"),
        checkLatest: z
          .boolean()
          .optional()
          .default(true)
          .describe("Whether to compare against latest version"),
      },
    },
    async ({ name, version, checkLatest }) => {
      try {
        return toolResult(await checkVersionHealth({ name, version, checkLatest }));
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  // get_latest_with_health
  server.registerTool(
    "get_latest_with_health",
    {
      title: "Get Latest Version with Health",
      description:
        "Always get the latest version of a package with comprehensive health check, security status, and safety assessment.",
      inputSchema: {
        name: z.string().describe("The npm package name"),
        includeAlternatives: z
          .boolean()
          .optional()
          .default(false)
          .describe("Include alternative package recommendations"),
      },
    },
    async ({ name, includeAlternatives }) => {
      try {
        return toolResult(await getLatestWithHealth({ name, includeAlternatives }));
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  // audit_outdated_packages
  server.registerTool(
    "audit_outdated_packages",
    {
      title: "Audit Outdated Packages",
      description:
        "Analyze package.json to find outdated packages, security vulnerabilities, and prioritize upgrades.",
      inputSchema: {
        packageJson: z
          .string()
          .or(z.record(z.string(), z.unknown()))
          .describe("package.json content as string or parsed object"),
        includeDevDependencies: z
          .boolean()
          .optional()
          .default(false)
          .describe("Check devDependencies too"),
        minSeverity: z
          .enum(["low", "moderate", "high", "critical"])
          .optional()
          .default("low")
          .describe("Minimum severity to report"),
      },
    },
    async ({ packageJson, includeDevDependencies, minSeverity }) => {
      try {
        return toolResult(
          await auditOutdatedPackages({ packageJson, includeDevDependencies, minSeverity }),
        );
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  // suggest_latest_for_category
  server.registerTool(
    "suggest_latest_for_category",
    {
      title: "Suggest Latest Packages for Category",
      description:
        "Get latest versions of top packages in a category with health scores and recommendations.",
      inputSchema: {
        category: z
          .string()
          .describe("Category ID (e.g., 'http-client', 'date-library', 'validation')"),
        limit: z
          .number()
          .min(1)
          .max(10)
          .optional()
          .default(5)
          .describe("Number of packages to return (1-10)"),
        minHealthScore: z
          .number()
          .min(0)
          .max(100)
          .optional()
          .default(60)
          .describe("Minimum health score (0-100)"),
      },
    },
    async ({ category, limit, minHealthScore }) => {
      try {
        return toolResult(await suggestLatestForCategory({ category, limit, minHealthScore }));
      } catch (error) {
        return errorResult(error);
      }
    },
  );
}
