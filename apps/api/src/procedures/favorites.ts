/**
 * Favorites Procedures
 *
 * oRPC procedures for user favorites (protected routes).
 */

import { protectedProcedure, publicProcedure } from "@packrun/api";
import {
  FavoriteActionResponseSchema,
  FavoriteCheckResponseSchema,
  FavoritesListResponseSchema,
  SuccessResponseSchema,
} from "@packrun/api/schemas";
import { db } from "@packrun/db/client";
import {
  addFavorite,
  checkFavorite,
  deleteUser,
  listFavorites,
  removeFavorite,
} from "@packrun/db/queries";
import { createId } from "@paralleldrive/cuid2";
import { z } from "zod";

/**
 * Get user favorites
 */
export const list = protectedProcedure
  .route({
    method: "GET",
    path: "/v1/favorites",
    summary: "Get user favorites",
    description: "Get the list of favorited packages for the authenticated user",
    tags: ["Favorites"],
  })
  .output(FavoritesListResponseSchema)
  .handler(async ({ context }) => {
    const favorites = await listFavorites(db!, context.user.id);
    return { favorites };
  });

/**
 * Add favorite
 */
export const add = protectedProcedure
  .route({
    method: "POST",
    path: "/v1/favorites/{name}",
    summary: "Add favorite",
    description: "Add a package to the user's favorites",
    tags: ["Favorites"],
  })
  .input(z.object({ name: z.string() }))
  .output(FavoriteActionResponseSchema)
  .handler(async ({ input, context }) => {
    const packageName = decodeURIComponent(input.name);
    await addFavorite(db!, createId(), context.user.id, packageName);
    return { success: true, packageName };
  });

/**
 * Remove favorite
 */
export const remove = protectedProcedure
  .route({
    method: "DELETE",
    path: "/v1/favorites/{name}",
    summary: "Remove favorite",
    description: "Remove a package from the user's favorites",
    tags: ["Favorites"],
  })
  .input(z.object({ name: z.string() }))
  .output(FavoriteActionResponseSchema)
  .handler(async ({ input, context }) => {
    const packageName = decodeURIComponent(input.name);
    await removeFavorite(db!, context.user.id, packageName);
    return { success: true, packageName };
  });

/**
 * Check favorite status
 * This is a public procedure that returns false if not authenticated
 */
export const check = publicProcedure
  .route({
    method: "GET",
    path: "/v1/favorites/check/{name}",
    summary: "Check favorite status",
    description: "Check if a package is in the user's favorites",
    tags: ["Favorites"],
  })
  .input(z.object({ name: z.string() }))
  .output(FavoriteCheckResponseSchema)
  .handler(async ({ input, context }) => {
    if (!context.user) {
      return { isFavorite: false };
    }

    const packageName = decodeURIComponent(input.name);
    const isFavorite = await checkFavorite(db!, context.user.id, packageName);

    return { isFavorite };
  });

/**
 * Delete account
 */
export const deleteAccount = protectedProcedure
  .route({
    method: "DELETE",
    path: "/v1/account",
    summary: "Delete account",
    description: "Delete the authenticated user's account and all associated data",
    tags: ["Account"],
  })
  .output(SuccessResponseSchema)
  .handler(async ({ context }) => {
    await deleteUser(db!, context.user.id);
    return { success: true };
  });

// =============================================================================
// Router
// =============================================================================

export const favoritesRouter = {
  list,
  add,
  remove,
  check,
  deleteAccount,
};
