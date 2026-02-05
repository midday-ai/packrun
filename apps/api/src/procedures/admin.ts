/**
 * Admin Procedures
 *
 * oRPC procedures for admin operations (health check).
 */

import { publicProcedure } from "@packrun/api";
import { HealthResponseSchema } from "@packrun/api/schemas";

/**
 * Health check
 */
export const health = publicProcedure
  .route({
    method: "GET",
    path: "/health",
    summary: "Health check",
    description: "Check if the API is healthy",
    tags: ["Admin"],
  })
  .output(HealthResponseSchema)
  .handler(async () => {
    return {
      status: "healthy" as const,
      timestamp: new Date().toISOString(),
      service: "packrun-api",
    };
  });

// =============================================================================
// Router
// =============================================================================

export const adminRouter = {
  health,
};
