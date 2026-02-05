/**
 * Common Schemas
 *
 * Shared Zod schemas used across multiple procedures.
 */

import { z } from "zod";

// =============================================================================
// Error & Success Responses
// =============================================================================

export const ErrorResponseSchema = z.object({
  error: z.string(),
});

export const SuccessResponseSchema = z.object({
  success: z.boolean(),
});

export const MessageResponseSchema = z.object({
  message: z.string(),
});

// =============================================================================
// Health Check
// =============================================================================

export const HealthCheckResponseSchema = z.object({
  status: z.string(),
  timestamp: z.string(),
  service: z.string(),
});

// =============================================================================
// Package Name Input (common parameter)
// =============================================================================

export const PackageNameInputSchema = z.object({
  name: z.string().min(1).describe("npm package name"),
});

export const PackageNameVersionInputSchema = z.object({
  name: z.string().min(1).describe("npm package name"),
  version: z.string().optional().describe("Specific version to check"),
});
