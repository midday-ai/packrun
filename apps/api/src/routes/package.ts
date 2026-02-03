/**
 * Package Routes - OpenAPI definitions for package endpoints
 */

import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import {
  checkDeprecated,
  checkTypes,
  checkVulnerabilities,
  findAlternatives,
} from "../tools/index";
import { getPackageHealth } from "../tools/health";
import { getPackageVersion } from "../tools/version";
import { getWeeklyDownloads } from "../tools/downloads";
import {
  CheckDeprecatedResponseSchema,
  CheckTypesResponseSchema,
  CheckVulnerabilitiesResponseSchema,
  ErrorResponseSchema,
  FindAlternativesResponseSchema,
  PackageHealthResponseSchema,
  PackageVersionResponseSchema,
  WeeklyDownloadsResponseSchema,
} from "./schemas/responses";

// Cache-Control headers
const CACHE = {
  LONG: "public, s-maxage=86400, stale-while-revalidate=3600",
  MEDIUM: "public, s-maxage=21600, stale-while-revalidate=3600",
  SHORT: "public, s-maxage=3600, stale-while-revalidate=600",
};

// Common param schema
const packageNameParam = z.object({
  name: z.string().openapi({
    param: { name: "name", in: "path" },
    description: "npm package name (URL-encoded for scoped packages)",
    example: "react",
  }),
});

// =============================================================================
// Routes
// =============================================================================

const getPackageVersionRoute = createRoute({
  method: "get",
  path: "/api/package/{name}/version",
  tags: ["Package"],
  summary: "Get package version",
  description: "Get the latest version of an npm package",
  request: {
    params: packageNameParam,
  },
  responses: {
    200: {
      content: { "application/json": { schema: PackageVersionResponseSchema } },
      description: "Package version information",
    },
    404: {
      content: { "application/json": { schema: ErrorResponseSchema } },
      description: "Package not found",
    },
  },
});

const getPackageDeprecatedRoute = createRoute({
  method: "get",
  path: "/api/package/{name}/deprecated",
  tags: ["Package"],
  summary: "Check if package is deprecated",
  description: "Check if a package is deprecated and get alternatives",
  request: {
    params: packageNameParam,
  },
  responses: {
    200: {
      content: { "application/json": { schema: CheckDeprecatedResponseSchema } },
      description: "Deprecation status",
    },
    404: {
      content: { "application/json": { schema: ErrorResponseSchema } },
      description: "Package not found",
    },
  },
});

const getPackageTypesRoute = createRoute({
  method: "get",
  path: "/api/package/{name}/types",
  tags: ["Package"],
  summary: "Check TypeScript types",
  description: "Check if a package has TypeScript types (bundled or via @types)",
  request: {
    params: packageNameParam,
  },
  responses: {
    200: {
      content: { "application/json": { schema: CheckTypesResponseSchema } },
      description: "TypeScript types information",
    },
    404: {
      content: { "application/json": { schema: ErrorResponseSchema } },
      description: "Package not found",
    },
  },
});

const getPackageVulnerabilitiesRoute = createRoute({
  method: "get",
  path: "/api/package/{name}/vulnerabilities",
  tags: ["Package"],
  summary: "Check vulnerabilities",
  description: "Check for known security vulnerabilities in a package version",
  request: {
    params: packageNameParam,
    query: z.object({
      version: z.string().optional().openapi({
        description: "Specific version to check (defaults to latest)",
        example: "18.2.0",
      }),
    }),
  },
  responses: {
    200: {
      content: { "application/json": { schema: CheckVulnerabilitiesResponseSchema } },
      description: "Vulnerability information",
    },
    404: {
      content: { "application/json": { schema: ErrorResponseSchema } },
      description: "Package not found",
    },
  },
});

const getPackageAlternativesRoute = createRoute({
  method: "get",
  path: "/api/package/{name}/alternatives",
  tags: ["Package"],
  summary: "Find alternatives",
  description: "Find alternative packages with recommendations",
  request: {
    params: packageNameParam,
  },
  responses: {
    200: {
      content: { "application/json": { schema: FindAlternativesResponseSchema } },
      description: "Alternative packages",
    },
    404: {
      content: { "application/json": { schema: ErrorResponseSchema } },
      description: "Package not found",
    },
  },
});

const getPackageDownloadsRoute = createRoute({
  method: "get",
  path: "/api/package/{name}/downloads",
  tags: ["Package"],
  summary: "Get download statistics",
  description: "Get weekly download history with sparkline data",
  request: {
    params: packageNameParam,
    query: z.object({
      weeks: z.string().optional().openapi({
        description: "Number of weeks of data (max 104)",
        example: "52",
      }),
    }),
  },
  responses: {
    200: {
      content: { "application/json": { schema: WeeklyDownloadsResponseSchema } },
      description: "Download statistics",
    },
    404: {
      content: { "application/json": { schema: ErrorResponseSchema } },
      description: "Package not found or no download data",
    },
    500: {
      content: { "application/json": { schema: ErrorResponseSchema } },
      description: "Server error",
    },
  },
});

const getPackageHealthRoute = createRoute({
  method: "get",
  path: "/api/package/{name}",
  tags: ["Package"],
  summary: "Get package health",
  description:
    "Get comprehensive package health assessment including security, quality, compatibility, popularity, alternatives, and AI recommendations",
  request: {
    params: packageNameParam,
  },
  responses: {
    200: {
      content: { "application/json": { schema: PackageHealthResponseSchema } },
      description: "Comprehensive package health data",
    },
    404: {
      content: { "application/json": { schema: ErrorResponseSchema } },
      description: "Package not found",
    },
    500: {
      content: { "application/json": { schema: ErrorResponseSchema } },
      description: "Server error",
    },
  },
});

// =============================================================================
// Create Router
// =============================================================================

export function createPackageRoutes() {
  const app = new OpenAPIHono();

  // GET /api/package/:name/version
  app.openapi(getPackageVersionRoute, async (c) => {
    try {
      const name = decodeURIComponent(c.req.param("name"));
      const result = await getPackageVersion({ name });
      c.header("Cache-Control", CACHE.SHORT);
      return c.json(result, 200);
    } catch (error) {
      return c.json({ error: error instanceof Error ? error.message : "Unknown error" }, 404);
    }
  });

  // GET /api/package/:name/deprecated
  app.openapi(getPackageDeprecatedRoute, async (c) => {
    try {
      const name = decodeURIComponent(c.req.param("name"));
      const result = await checkDeprecated({ name });
      c.header("Cache-Control", CACHE.LONG);
      return c.json(result, 200);
    } catch (error) {
      return c.json({ error: error instanceof Error ? error.message : "Unknown error" }, 404);
    }
  });

  // GET /api/package/:name/types
  app.openapi(getPackageTypesRoute, async (c) => {
    try {
      const name = decodeURIComponent(c.req.param("name"));
      const result = await checkTypes({ name });
      c.header("Cache-Control", CACHE.LONG);
      return c.json(result, 200);
    } catch (error) {
      return c.json({ error: error instanceof Error ? error.message : "Unknown error" }, 404);
    }
  });

  // GET /api/package/:name/vulnerabilities
  app.openapi(getPackageVulnerabilitiesRoute, async (c) => {
    try {
      const name = decodeURIComponent(c.req.param("name"));
      const version = c.req.query("version");
      const result = await checkVulnerabilities({ name, version });
      c.header("Cache-Control", CACHE.MEDIUM);
      return c.json(result, 200);
    } catch (error) {
      return c.json({ error: error instanceof Error ? error.message : "Unknown error" }, 404);
    }
  });

  // GET /api/package/:name/alternatives
  app.openapi(getPackageAlternativesRoute, async (c) => {
    try {
      const name = decodeURIComponent(c.req.param("name"));
      const result = await findAlternatives({ name });
      c.header("Cache-Control", CACHE.LONG);
      return c.json(result, 200);
    } catch (error) {
      return c.json({ error: error instanceof Error ? error.message : "Unknown error" }, 404);
    }
  });

  // GET /api/package/:name/downloads
  app.openapi(getPackageDownloadsRoute, async (c) => {
    try {
      const name = decodeURIComponent(c.req.param("name"));
      const weeks = Math.min(Number.parseInt(c.req.query("weeks") || "52"), 104);
      const result = await getWeeklyDownloads(name, weeks);
      if (!result) {
        return c.json({ error: "Package not found or no download data" }, 404);
      }
      c.header("Cache-Control", CACHE.MEDIUM);
      return c.json(result, 200);
    } catch (error) {
      return c.json({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
    }
  });

  // GET /api/package/:name (comprehensive health)
  app.openapi(getPackageHealthRoute, async (c) => {
    try {
      const name = decodeURIComponent(c.req.param("name"));
      const result = await getPackageHealth(name);
      if (!result) {
        return c.json({ error: "Package not found" }, 404);
      }
      c.header("Cache-Control", CACHE.LONG);
      return c.json(result, 200);
    } catch (error) {
      return c.json({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
    }
  });

  return app;
}
