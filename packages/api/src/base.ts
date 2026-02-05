/**
 * Base oRPC Procedures
 *
 * Defines reusable procedure builders with middleware for public and protected routes.
 */

import { ORPCError, os } from "@orpc/server";

/**
 * User type from session
 */
export interface User {
  id: string;
  name: string;
  email: string;
  image?: string | null;
}

/**
 * Base context provided to all procedures
 */
export interface Context {
  headers: Headers;
  user: User | null;
}

/**
 * Context for authenticated procedures
 */
export interface AuthenticatedContext extends Context {
  user: User;
}

/**
 * Base procedure builder with context type
 */
const base = os.$context<Context>();

/**
 * Public procedure - no authentication required
 */
export const publicProcedure = base;

/**
 * Protected procedure - requires authenticated user
 *
 * Throws UNAUTHORIZED if user is not logged in
 */
export const protectedProcedure = base.use(({ context, next }) => {
  if (!context.user) {
    throw new ORPCError("UNAUTHORIZED", {
      message: "You must be logged in to access this resource",
    });
  }

  return next({
    context: {
      ...context,
      user: context.user,
    } satisfies AuthenticatedContext,
  });
});
