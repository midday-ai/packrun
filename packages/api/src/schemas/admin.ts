/**
 * Admin Schemas
 *
 * Zod schemas for admin-related API responses (health check).
 */

import { z } from "zod";

// =============================================================================
// Health Check
// =============================================================================

export const HealthResponseSchema = z.object({
  status: z.literal("healthy"),
  timestamp: z.string(),
  service: z.string(),
});

// Type exports
export type HealthResponse = z.infer<typeof HealthResponseSchema>;
