/**
 * Favorites Routes - OpenAPI definitions for user favorites and account endpoints
 */

import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { createId } from "@paralleldrive/cuid2";
import { eq, and } from "drizzle-orm";
import { auth } from "../lib/auth";
import { db } from "../lib/db";
import { favorite, user as userTable } from "../lib/auth-schema";
import {
  ErrorResponseSchema,
  FavoriteActionResponseSchema,
  FavoriteCheckResponseSchema,
  FavoritesListResponseSchema,
  SuccessResponseSchema,
} from "./schemas/responses";

// Helper to get current user from session
async function getCurrentUser(c: { req: { raw: Request } }) {
  if (!auth) return null;
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  return session?.user || null;
}

// =============================================================================
// Routes
// =============================================================================

const getFavoritesRoute = createRoute({
  method: "get",
  path: "/api/favorites",
  tags: ["Favorites"],
  summary: "Get user favorites",
  description: "Get the list of favorited packages for the authenticated user",
  security: [{ bearerAuth: [] }],
  responses: {
    200: {
      content: { "application/json": { schema: FavoritesListResponseSchema } },
      description: "List of favorite packages",
    },
    401: {
      content: { "application/json": { schema: ErrorResponseSchema } },
      description: "Unauthorized",
    },
    500: {
      content: { "application/json": { schema: ErrorResponseSchema } },
      description: "Server error",
    },
  },
});

const addFavoriteRoute = createRoute({
  method: "post",
  path: "/api/favorites/{name}",
  tags: ["Favorites"],
  summary: "Add favorite",
  description: "Add a package to the user's favorites",
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({
      name: z.string().openapi({
        param: { name: "name", in: "path" },
        description: "Package name to favorite",
        example: "react",
      }),
    }),
  },
  responses: {
    200: {
      content: { "application/json": { schema: FavoriteActionResponseSchema } },
      description: "Favorite added",
    },
    401: {
      content: { "application/json": { schema: ErrorResponseSchema } },
      description: "Unauthorized",
    },
    500: {
      content: { "application/json": { schema: ErrorResponseSchema } },
      description: "Server error",
    },
  },
});

const removeFavoriteRoute = createRoute({
  method: "delete",
  path: "/api/favorites/{name}",
  tags: ["Favorites"],
  summary: "Remove favorite",
  description: "Remove a package from the user's favorites",
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({
      name: z.string().openapi({
        param: { name: "name", in: "path" },
        description: "Package name to unfavorite",
        example: "react",
      }),
    }),
  },
  responses: {
    200: {
      content: { "application/json": { schema: FavoriteActionResponseSchema } },
      description: "Favorite removed",
    },
    401: {
      content: { "application/json": { schema: ErrorResponseSchema } },
      description: "Unauthorized",
    },
    500: {
      content: { "application/json": { schema: ErrorResponseSchema } },
      description: "Server error",
    },
  },
});

const checkFavoriteRoute = createRoute({
  method: "get",
  path: "/api/favorites/check/{name}",
  tags: ["Favorites"],
  summary: "Check favorite status",
  description: "Check if a package is in the user's favorites",
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({
      name: z.string().openapi({
        param: { name: "name", in: "path" },
        description: "Package name to check",
        example: "react",
      }),
    }),
  },
  responses: {
    200: {
      content: { "application/json": { schema: FavoriteCheckResponseSchema } },
      description: "Favorite status",
    },
  },
});

const deleteAccountRoute = createRoute({
  method: "delete",
  path: "/api/account",
  tags: ["Account"],
  summary: "Delete account",
  description: "Delete the authenticated user's account and all associated data",
  security: [{ bearerAuth: [] }],
  responses: {
    200: {
      content: { "application/json": { schema: SuccessResponseSchema } },
      description: "Account deleted",
    },
    401: {
      content: { "application/json": { schema: ErrorResponseSchema } },
      description: "Unauthorized",
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

export function createFavoritesRoutes() {
  const app = new OpenAPIHono();

  // GET /api/favorites
  app.openapi(getFavoritesRoute, async (c) => {
    c.header("Cache-Control", "no-store, no-cache, must-revalidate");
    const user = await getCurrentUser(c);
    if (!user) {
      return c.json({ error: "Unauthorized" }, 401);
    }
    if (!db) {
      return c.json({ error: "Database not configured" }, 500);
    }
    try {
      const favorites = await db
        .select()
        .from(favorite)
        .where(eq(favorite.userId, user.id))
        .orderBy(favorite.createdAt);
      return c.json({ favorites: favorites.map((f) => f.packageName) }, 200);
    } catch (error) {
      console.error("[Favorites] Error fetching:", error);
      return c.json({ error: "Failed to fetch favorites" }, 500);
    }
  });

  // POST /api/favorites/:name
  app.openapi(addFavoriteRoute, async (c) => {
    c.header("Cache-Control", "no-store");
    const user = await getCurrentUser(c);
    if (!user) {
      return c.json({ error: "Unauthorized" }, 401);
    }
    if (!db) {
      return c.json({ error: "Database not configured" }, 500);
    }
    const packageName = decodeURIComponent(c.req.param("name"));
    try {
      await db
        .insert(favorite)
        .values({
          id: createId(),
          userId: user.id,
          packageName,
        })
        .onConflictDoNothing();
      return c.json({ success: true, packageName }, 200);
    } catch (error) {
      console.error("[Favorites] Error adding:", error);
      return c.json({ error: "Failed to add favorite" }, 500);
    }
  });

  // DELETE /api/favorites/:name
  app.openapi(removeFavoriteRoute, async (c) => {
    c.header("Cache-Control", "no-store");
    const user = await getCurrentUser(c);
    if (!user) {
      return c.json({ error: "Unauthorized" }, 401);
    }
    if (!db) {
      return c.json({ error: "Database not configured" }, 500);
    }
    const packageName = decodeURIComponent(c.req.param("name"));
    try {
      await db
        .delete(favorite)
        .where(and(eq(favorite.userId, user.id), eq(favorite.packageName, packageName)));
      return c.json({ success: true, packageName }, 200);
    } catch (error) {
      console.error("[Favorites] Error removing:", error);
      return c.json({ error: "Failed to remove favorite" }, 500);
    }
  });

  // GET /api/favorites/check/:name
  app.openapi(checkFavoriteRoute, async (c) => {
    c.header("Cache-Control", "no-store, no-cache, must-revalidate");
    const user = await getCurrentUser(c);
    if (!user) {
      return c.json({ isFavorite: false }, 200);
    }
    if (!db) {
      return c.json({ isFavorite: false }, 200);
    }
    const packageName = decodeURIComponent(c.req.param("name"));
    try {
      const result = await db
        .select()
        .from(favorite)
        .where(and(eq(favorite.userId, user.id), eq(favorite.packageName, packageName)))
        .limit(1);
      return c.json({ isFavorite: result.length > 0 }, 200);
    } catch (error) {
      return c.json({ isFavorite: false }, 200);
    }
  });

  // DELETE /api/account
  app.openapi(deleteAccountRoute, async (c) => {
    c.header("Cache-Control", "no-store");
    const currentUser = await getCurrentUser(c);
    if (!currentUser) {
      return c.json({ error: "Unauthorized" }, 401);
    }
    if (!db) {
      return c.json({ error: "Database not configured" }, 500);
    }
    try {
      await db.delete(userTable).where(eq(userTable.id, currentUser.id));
      return c.json({ success: true }, 200);
    } catch (error) {
      console.error("[Account] Error deleting:", error);
      return c.json({ error: "Failed to delete account" }, 500);
    }
  });

  return app;
}
