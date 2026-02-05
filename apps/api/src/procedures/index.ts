/**
 * Procedures Index
 *
 * Exports all procedure routers and the combined app router.
 */

export { adminRouter } from "./admin";
export { compareRouter } from "./compare";
export { favoritesRouter } from "./favorites";
export { notificationsRouter } from "./notifications";
export { packageRouter } from "./package";
export { searchRouter } from "./search";

import { adminRouter } from "./admin";
import { compareRouter } from "./compare";
import { favoritesRouter } from "./favorites";
import { notificationsRouter } from "./notifications";
// Combined app router
import { packageRouter } from "./package";
import { searchRouter } from "./search";

/**
 * Main application router
 *
 * This is the oRPC router that combines all domain routers.
 * Used by RPC handler for internal type-safe calls.
 */
export const appRouter = {
  package: packageRouter,
  search: searchRouter,
  compare: compareRouter,
  favorites: favoritesRouter,
  notifications: notificationsRouter,
  admin: adminRouter,
};

export type AppRouter = typeof appRouter;

/**
 * Public router for OpenAPI documentation
 *
 * Excludes admin routes from the public API documentation.
 */
export const publicRouter = {
  package: packageRouter,
  search: searchRouter,
  compare: compareRouter,
  favorites: favoritesRouter,
  notifications: notificationsRouter,
};

export type PublicRouter = typeof publicRouter;
