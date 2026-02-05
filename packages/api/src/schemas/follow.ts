/**
 * Follow Schemas
 *
 * Zod schemas for package following API responses.
 */

import { z } from "zod";

// =============================================================================
// Following
// =============================================================================

export const FollowingListResponseSchema = z.object({
  following: z.array(z.string()),
});

export const FollowActionResponseSchema = z.object({
  success: z.boolean(),
  packageName: z.string(),
});

export const FollowCheckResponseSchema = z.object({
  isFollowing: z.boolean(),
});

// Type exports
export type FollowingListResponse = z.infer<typeof FollowingListResponseSchema>;
export type FollowActionResponse = z.infer<typeof FollowActionResponseSchema>;
export type FollowCheckResponse = z.infer<typeof FollowCheckResponseSchema>;
