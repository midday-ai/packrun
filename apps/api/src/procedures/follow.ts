/**
 * Follow Procedures
 *
 * oRPC procedures for package following (protected routes).
 */

import { protectedProcedure, publicProcedure } from "@packrun/api";
import {
  FollowActionResponseSchema,
  FollowCheckResponseSchema,
  FollowingListResponseSchema,
  SuccessResponseSchema,
} from "@packrun/api/schemas";
import { db } from "@packrun/db/client";
import {
  deleteUser,
  followPackage,
  isFollowingPackage,
  listFollowedPackages,
  unfollowPackage,
} from "@packrun/db/queries";
import { createId } from "@paralleldrive/cuid2";
import { z } from "zod";

/**
 * Get followed packages
 */
export const list = protectedProcedure
  .route({
    method: "GET",
    path: "/v1/following",
    summary: "Get followed packages",
    description: "Get the list of followed packages for the authenticated user",
    tags: ["Following"],
  })
  .output(FollowingListResponseSchema)
  .handler(async ({ context }) => {
    const following = await listFollowedPackages(db!, context.user.id);
    return { following };
  });

/**
 * Follow a package
 */
export const follow = protectedProcedure
  .route({
    method: "POST",
    path: "/v1/following/{name}",
    summary: "Follow package",
    description: "Follow a package to get notified about updates",
    tags: ["Following"],
  })
  .input(z.object({ name: z.string() }))
  .output(FollowActionResponseSchema)
  .handler(async ({ input, context }) => {
    const packageName = decodeURIComponent(input.name);
    await followPackage(db!, createId(), context.user.id, packageName);
    return { success: true, packageName };
  });

/**
 * Unfollow a package
 */
export const unfollow = protectedProcedure
  .route({
    method: "DELETE",
    path: "/v1/following/{name}",
    summary: "Unfollow package",
    description: "Stop following a package",
    tags: ["Following"],
  })
  .input(z.object({ name: z.string() }))
  .output(FollowActionResponseSchema)
  .handler(async ({ input, context }) => {
    const packageName = decodeURIComponent(input.name);
    await unfollowPackage(db!, context.user.id, packageName);
    return { success: true, packageName };
  });

/**
 * Check follow status
 * This is a public procedure that returns false if not authenticated
 */
export const check = publicProcedure
  .route({
    method: "GET",
    path: "/v1/following/check/{name}",
    summary: "Check follow status",
    description: "Check if a package is being followed by the user",
    tags: ["Following"],
  })
  .input(z.object({ name: z.string() }))
  .output(FollowCheckResponseSchema)
  .handler(async ({ input, context }) => {
    if (!context.user) {
      return { isFollowing: false };
    }

    const packageName = decodeURIComponent(input.name);
    const isFollowing = await isFollowingPackage(db!, context.user.id, packageName);

    return { isFollowing };
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

export const followRouter = {
  list,
  follow,
  unfollow,
  check,
  deleteAccount,
};
