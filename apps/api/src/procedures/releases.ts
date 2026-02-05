/**
 * Releases Procedures
 *
 * oRPC procedures for upcoming releases.
 */

import { protectedProcedure, publicProcedure } from "@packrun/api";
import {
  CreateReleaseInputSchema,
  ReleaseFollowCheckResponseSchema,
  ReleaseFollowResponseSchema,
  ReleaseListResponseSchema,
  ReleaseResponseSchema,
  SuccessResponseSchema,
  UpdateReleaseInputSchema,
} from "@packrun/api/schemas";
import { db } from "@packrun/db/client";
import {
  createUpcomingRelease,
  deleteUpcomingRelease,
  followRelease,
  getFeaturedReleases,
  getReleaseFollowerCount,
  getUpcomingRelease,
  isFollowingRelease,
  listUpcomingReleases,
  unfollowRelease,
  updateUpcomingRelease,
} from "@packrun/db/queries";
import { createId } from "@paralleldrive/cuid2";
import { z } from "zod";

// Revalidate ISR pages after release changes
async function revalidateRelease(packageName: string | null) {
  const webUrl = process.env.WEB_URL || "http://localhost:3000";
  const secret = process.env.REVALIDATE_SECRET;

  if (!secret) {
    console.warn("[releases] REVALIDATE_SECRET not configured, skipping ISR revalidation");
    return;
  }

  try {
    await fetch(`${webUrl}/api/revalidate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "release",
        packageName,
        secret,
      }),
    });
  } catch (error) {
    console.error("[releases] Failed to revalidate ISR:", error);
  }
}

// Helper to convert DB record to API response
function formatRelease(
  release: {
    id: string;
    packageName: string | null;
    title: string;
    description: string | null;
    targetVersion: string;
    versionMatchType: string;
    releasedVersion: string | null;
    releasedAt: Date | null;
    status: string;
    logoUrl: string | null;
    websiteUrl: string | null;
    expectedDate: Date | null;
    submittedById: string;
    featured: boolean;
    createdAt: Date;
    updatedAt: Date;
  },
  followerCount?: number,
) {
  return {
    ...release,
    versionMatchType: release.versionMatchType as "exact" | "major",
    status: release.status as "upcoming" | "released",
    releasedAt: release.releasedAt?.toISOString() ?? null,
    expectedDate: release.expectedDate?.toISOString() ?? null,
    createdAt: release.createdAt.toISOString(),
    updatedAt: release.updatedAt.toISOString(),
    followerCount,
  };
}

/**
 * List upcoming releases
 */
export const list = publicProcedure
  .route({
    method: "GET",
    path: "/v1/releases",
    summary: "List upcoming releases",
    description: "Get a paginated list of upcoming releases",
    tags: ["Releases"],
  })
  .input(
    z.object({
      status: z.enum(["upcoming", "released"]).optional(),
      packageName: z.string().optional(),
      limit: z.coerce.number().int().min(1).max(50).default(20).optional(),
      offset: z.coerce.number().int().min(0).default(0).optional(),
    }),
  )
  .output(ReleaseListResponseSchema)
  .handler(async ({ input }) => {
    const { releases, total } = await listUpcomingReleases(db!, {
      status: input.status,
      packageName: input.packageName,
      limit: input.limit ?? 20,
      offset: input.offset ?? 0,
    });

    return {
      releases: releases.map((r) => formatRelease(r)),
      total,
    };
  });

/**
 * Get featured releases (for homepage)
 */
export const featured = publicProcedure
  .route({
    method: "GET",
    path: "/v1/releases/featured",
    summary: "Get featured releases",
    description: "Get featured upcoming releases for the homepage",
    tags: ["Releases"],
  })
  .output(ReleaseListResponseSchema)
  .handler(async () => {
    const releases = await getFeaturedReleases(db!, 4);

    // Get follower counts for each
    const releasesWithCounts = await Promise.all(
      releases.map(async (r) => {
        const followerCount = await getReleaseFollowerCount(db!, r.id);
        return formatRelease(r, followerCount);
      }),
    );

    return {
      releases: releasesWithCounts,
      total: releasesWithCounts.length,
    };
  });

/**
 * Get a single release
 */
export const get = publicProcedure
  .route({
    method: "GET",
    path: "/v1/releases/{id}",
    summary: "Get release",
    description: "Get details of a single upcoming release",
    tags: ["Releases"],
  })
  .input(z.object({ id: z.string() }))
  .output(ReleaseResponseSchema)
  .handler(async ({ input }) => {
    const release = await getUpcomingRelease(db!, input.id);

    if (!release) {
      throw new Error("Release not found");
    }

    const followerCount = await getReleaseFollowerCount(db!, release.id);

    return {
      release: formatRelease(release, followerCount),
    };
  });

/**
 * Create an upcoming release
 */
export const create = protectedProcedure
  .route({
    method: "POST",
    path: "/v1/releases",
    summary: "Create release",
    description: "Submit a new upcoming release",
    tags: ["Releases"],
  })
  .input(CreateReleaseInputSchema)
  .output(ReleaseResponseSchema)
  .handler(async ({ input, context }) => {
    const release = await createUpcomingRelease(db!, {
      id: createId(),
      packageName: input.packageName,
      title: input.title,
      description: input.description,
      targetVersion: input.targetVersion,
      versionMatchType: input.versionMatchType,
      websiteUrl: input.websiteUrl || null,
      expectedDate: input.expectedDate ? new Date(input.expectedDate) : null,
      submittedById: context.user.id,
    });

    // Revalidate ISR pages
    revalidateRelease(input.packageName || null);

    return {
      release: formatRelease(release, 0),
    };
  });

/**
 * Update an upcoming release
 */
export const update = protectedProcedure
  .route({
    method: "PATCH",
    path: "/v1/releases/{id}",
    summary: "Update release",
    description: "Update an upcoming release (owner only)",
    tags: ["Releases"],
  })
  .input(UpdateReleaseInputSchema)
  .output(ReleaseResponseSchema)
  .handler(async ({ input, context }) => {
    // Check ownership
    const existing = await getUpcomingRelease(db!, input.id);
    if (!existing) {
      throw new Error("Release not found");
    }
    if (existing.submittedById !== context.user.id) {
      throw new Error("Not authorized to update this release");
    }

    const updated = await updateUpcomingRelease(db!, input.id, {
      title: input.title,
      description: input.description,
      websiteUrl: input.websiteUrl || null,
      expectedDate: input.expectedDate ? new Date(input.expectedDate) : undefined,
      featured: input.featured,
    });

    if (!updated) {
      throw new Error("Failed to update release");
    }

    // Revalidate ISR pages
    revalidateRelease(updated.packageName);

    const followerCount = await getReleaseFollowerCount(db!, updated.id);

    return {
      release: formatRelease(updated, followerCount),
    };
  });

/**
 * Delete an upcoming release
 */
export const remove = protectedProcedure
  .route({
    method: "DELETE",
    path: "/v1/releases/{id}",
    summary: "Delete release",
    description: "Delete an upcoming release (owner only)",
    tags: ["Releases"],
  })
  .input(z.object({ id: z.string() }))
  .output(SuccessResponseSchema)
  .handler(async ({ input, context }) => {
    // Check ownership
    const existing = await getUpcomingRelease(db!, input.id);
    if (!existing) {
      throw new Error("Release not found");
    }
    if (existing.submittedById !== context.user.id) {
      throw new Error("Not authorized to delete this release");
    }

    await deleteUpcomingRelease(db!, input.id);

    // Revalidate ISR pages
    revalidateRelease(existing.packageName);

    return { success: true };
  });

/**
 * Follow a release
 */
export const follow = protectedProcedure
  .route({
    method: "POST",
    path: "/v1/releases/{id}/follow",
    summary: "Follow release",
    description: "Follow an upcoming release to get notified when it launches",
    tags: ["Releases"],
  })
  .input(z.object({ id: z.string() }))
  .output(ReleaseFollowResponseSchema)
  .handler(async ({ input, context }) => {
    await followRelease(db!, createId(), context.user.id, input.id);
    return { success: true, isFollowing: true };
  });

/**
 * Unfollow a release
 */
export const unfollow = protectedProcedure
  .route({
    method: "DELETE",
    path: "/v1/releases/{id}/follow",
    summary: "Unfollow release",
    description: "Stop following an upcoming release",
    tags: ["Releases"],
  })
  .input(z.object({ id: z.string() }))
  .output(ReleaseFollowResponseSchema)
  .handler(async ({ input, context }) => {
    await unfollowRelease(db!, context.user.id, input.id);
    return { success: true, isFollowing: false };
  });

/**
 * Check follow status
 */
export const checkFollow = publicProcedure
  .route({
    method: "GET",
    path: "/v1/releases/{id}/follow",
    summary: "Check follow status",
    description: "Check if the user is following a release",
    tags: ["Releases"],
  })
  .input(z.object({ id: z.string() }))
  .output(ReleaseFollowCheckResponseSchema)
  .handler(async ({ input, context }) => {
    if (!context.user) {
      return { isFollowing: false };
    }

    const isFollowing = await isFollowingRelease(db!, context.user.id, input.id);
    return { isFollowing };
  });

// =============================================================================
// Router
// =============================================================================

export const releasesRouter = {
  list,
  featured,
  get,
  create,
  update,
  remove,
  follow,
  unfollow,
  checkFollow,
};
