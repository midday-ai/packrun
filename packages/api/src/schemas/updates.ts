/**
 * Updates Schemas
 *
 * Zod schemas for live npm updates SSE stream.
 */

import { z } from "zod";

// =============================================================================
// SSE Events
// =============================================================================

export const UpdateEventSchema = z.object({
  name: z.string(),
  seq: z.string(),
  timestamp: z.number(),
});

export const ConnectedEventSchema = z.object({
  seq: z.string(),
});

export const ErrorEventSchema = z.object({
  message: z.string(),
});

// Type exports
export type UpdateEvent = z.infer<typeof UpdateEventSchema>;
export type ConnectedEvent = z.infer<typeof ConnectedEventSchema>;
export type ErrorEvent = z.infer<typeof ErrorEventSchema>;
