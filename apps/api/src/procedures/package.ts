/**
 * Package Procedures
 *
 * oRPC procedures for package-related endpoints.
 */

import { ORPCError } from "@orpc/server";
import { publicProcedure } from "@packrun/api";
import {
  CheckDeprecatedResponseSchema,
  CheckTypesResponseSchema,
  CheckVulnerabilitiesResponseSchema,
  FindAlternativesResponseSchema,
  InstallSizeResponseSchema,
  PackageHealthResponseSchema,
  PackageVersionResponseSchema,
  WeeklyDownloadsResponseSchema,
} from "@packrun/api/schemas";
import { z } from "zod";
import { getInstallSize } from "../lib/install-size";
import { getWeeklyDownloads } from "../tools/downloads";
import { getPackageHealth } from "../tools/health";
import {
  checkDeprecated,
  checkTypes,
  checkVulnerabilities,
  findAlternatives,
} from "../tools/index";
import { getPackageVersion } from "../tools/version";

// =============================================================================
// Procedures
// =============================================================================

/**
 * Get package version
 */
export const getVersion = publicProcedure
  .route({
    method: "GET",
    path: "/v1/package/{name}/version",
    summary: "Get package version",
    description: "Get the latest version of an npm package",
    tags: ["Package"],
  })
  .input(z.object({ name: z.string() }))
  .output(PackageVersionResponseSchema)
  .handler(async ({ input }) => {
    const name = decodeURIComponent(input.name);
    try {
      return await getPackageVersion({ name });
    } catch (error) {
      throw new ORPCError("NOT_FOUND", {
        message: error instanceof Error ? error.message : "Package not found",
      });
    }
  });

/**
 * Check if package is deprecated
 */
export const checkDeprecatedProcedure = publicProcedure
  .route({
    method: "GET",
    path: "/v1/package/{name}/deprecated",
    summary: "Check if package is deprecated",
    description: "Check if a package is deprecated and get alternatives",
    tags: ["Package"],
  })
  .input(z.object({ name: z.string() }))
  .output(CheckDeprecatedResponseSchema)
  .handler(async ({ input }) => {
    const name = decodeURIComponent(input.name);
    try {
      return await checkDeprecated({ name });
    } catch (error) {
      throw new ORPCError("NOT_FOUND", {
        message: error instanceof Error ? error.message : "Package not found",
      });
    }
  });

/**
 * Check TypeScript types
 */
export const checkTypesProcedure = publicProcedure
  .route({
    method: "GET",
    path: "/v1/package/{name}/types",
    summary: "Check TypeScript types",
    description: "Check if a package has TypeScript types (bundled or via @types)",
    tags: ["Package"],
  })
  .input(z.object({ name: z.string() }))
  .output(CheckTypesResponseSchema)
  .handler(async ({ input }) => {
    const name = decodeURIComponent(input.name);
    try {
      return await checkTypes({ name });
    } catch (error) {
      throw new ORPCError("NOT_FOUND", {
        message: error instanceof Error ? error.message : "Package not found",
      });
    }
  });

/**
 * Check vulnerabilities
 */
export const checkVulnerabilitiesProcedure = publicProcedure
  .route({
    method: "GET",
    path: "/v1/package/{name}/vulnerabilities",
    summary: "Check vulnerabilities",
    description: "Check for known security vulnerabilities in a package version",
    tags: ["Package"],
  })
  .input(
    z.object({
      name: z.string(),
      version: z.string().optional(),
    }),
  )
  .output(CheckVulnerabilitiesResponseSchema)
  .handler(async ({ input }) => {
    const name = decodeURIComponent(input.name);
    try {
      return await checkVulnerabilities({ name, version: input.version });
    } catch (error) {
      throw new ORPCError("NOT_FOUND", {
        message: error instanceof Error ? error.message : "Package not found",
      });
    }
  });

/**
 * Find alternatives
 */
export const findAlternativesProcedure = publicProcedure
  .route({
    method: "GET",
    path: "/v1/package/{name}/alternatives",
    summary: "Find alternatives",
    description: "Find alternative packages with recommendations",
    tags: ["Package"],
  })
  .input(z.object({ name: z.string() }))
  .output(FindAlternativesResponseSchema)
  .handler(async ({ input }) => {
    const name = decodeURIComponent(input.name);
    try {
      return await findAlternatives({ name });
    } catch (error) {
      throw new ORPCError("NOT_FOUND", {
        message: error instanceof Error ? error.message : "Package not found",
      });
    }
  });

/**
 * Get download statistics
 */
export const getDownloads = publicProcedure
  .route({
    method: "GET",
    path: "/v1/package/{name}/downloads",
    summary: "Get download statistics",
    description: "Get weekly download history with sparkline data",
    tags: ["Package"],
  })
  .input(
    z.object({
      name: z.string(),
      weeks: z.coerce.number().int().min(1).max(104).default(52).optional(),
    }),
  )
  .output(WeeklyDownloadsResponseSchema)
  .handler(async ({ input }) => {
    const name = decodeURIComponent(input.name);
    const weeks = input.weeks ?? 52;

    const result = await getWeeklyDownloads(name, weeks);
    if (!result) {
      throw new ORPCError("NOT_FOUND", {
        message: "Package not found or no download data",
      });
    }
    return result;
  });

/**
 * Get install size
 */
export const getInstallSizeProcedure = publicProcedure
  .route({
    method: "GET",
    path: "/v1/package/{name}/install-size",
    summary: "Get install size",
    description:
      "Get package unpacked size and total install size including all transitive dependencies",
    tags: ["Package"],
  })
  .input(
    z.object({
      name: z.string(),
      version: z.string().optional(),
    }),
  )
  .output(InstallSizeResponseSchema)
  .handler(async ({ input }) => {
    const name = decodeURIComponent(input.name);

    const result = await getInstallSize(name, input.version || undefined);
    if (!result) {
      throw new ORPCError("NOT_FOUND", {
        message: "Package not found or resolution failed",
      });
    }
    return result;
  });

/**
 * Get comprehensive package health
 */
export const getHealth = publicProcedure
  .route({
    method: "GET",
    path: "/v1/package/{name}",
    summary: "Get package health",
    description:
      "Get comprehensive package health assessment including security, quality, compatibility, popularity, alternatives, and AI recommendations",
    tags: ["Package"],
  })
  .input(z.object({ name: z.string() }))
  .output(PackageHealthResponseSchema)
  .handler(async ({ input }) => {
    const name = decodeURIComponent(input.name);

    const result = await getPackageHealth(name);
    if (!result) {
      throw new ORPCError("NOT_FOUND", {
        message: "Package not found",
      });
    }
    return result;
  });

// =============================================================================
// Router
// =============================================================================

export const packageRouter = {
  getVersion,
  checkDeprecated: checkDeprecatedProcedure,
  checkTypes: checkTypesProcedure,
  checkVulnerabilities: checkVulnerabilitiesProcedure,
  findAlternatives: findAlternativesProcedure,
  getDownloads,
  getInstallSize: getInstallSizeProcedure,
  getHealth,
};
