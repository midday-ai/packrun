/**
 * @packrun/api
 *
 * Shared oRPC schemas, base procedures, and types for the Packrun API.
 *
 * The actual router is implemented in apps/api/src/procedures/index.ts.
 * This package provides:
 * - Zod schemas for all API responses
 * - Base procedures (publicProcedure, protectedProcedure)
 * - Context types for authentication
 */

// Base procedures (for extending in apps/api)
export {
  type AuthenticatedContext,
  type Context,
  protectedProcedure,
  publicProcedure,
  type User,
} from "./base";

// All schemas
export * from "./schemas";
