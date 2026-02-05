/**
 * Releases Schemas
 *
 * Zod schemas for upcoming releases API.
 */

import { z } from "zod";

// =============================================================================
// Upcoming Release Schemas
// =============================================================================

export const UpcomingReleaseSchema = z.object({
  id: z.string(),
  packageName: z.string().nullable(),
  title: z.string(),
  description: z.string().nullable(),
  targetVersion: z.string(),
  versionMatchType: z.enum(["exact", "major"]),
  releasedVersion: z.string().nullable(),
  releasedAt: z.string().nullable(),
  status: z.enum(["upcoming", "released"]),
  logoUrl: z.string().nullable(),
  websiteUrl: z.string().nullable(),
  expectedDate: z.string().nullable(),
  submittedById: z.string(),
  featured: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
  followerCount: z.number().optional(),
});

export const ReleaseListResponseSchema = z.object({
  releases: z.array(UpcomingReleaseSchema),
  total: z.number(),
});

export const ReleaseResponseSchema = z.object({
  release: UpcomingReleaseSchema,
});

export const CreateReleaseInputSchema = z.object({
  packageName: z.string().min(1, "Package name is required"),
  title: z.string().min(3).max(100),
  description: z.string().max(2000).optional(),
  targetVersion: z.string().min(1, "Version is required"),
  versionMatchType: z.enum(["exact", "major"]).default("exact"),
  websiteUrl: z.string().url().optional().or(z.literal("")),
  expectedDate: z.string().optional(), // ISO date string
});

export const UpdateReleaseInputSchema = z.object({
  id: z.string(),
  title: z.string().min(3).max(100).optional(),
  description: z.string().max(2000).optional(),
  websiteUrl: z.string().url().optional().or(z.literal("")),
  expectedDate: z.string().optional(),
  featured: z.boolean().optional(),
});

export const ReleaseFollowResponseSchema = z.object({
  success: z.boolean(),
  isFollowing: z.boolean(),
});

export const ReleaseFollowCheckResponseSchema = z.object({
  isFollowing: z.boolean(),
});

// Type exports
export type UpcomingRelease = z.infer<typeof UpcomingReleaseSchema>;
export type ReleaseListResponse = z.infer<typeof ReleaseListResponseSchema>;
export type ReleaseResponse = z.infer<typeof ReleaseResponseSchema>;
export type CreateReleaseInput = z.infer<typeof CreateReleaseInputSchema>;
export type UpdateReleaseInput = z.infer<typeof UpdateReleaseInputSchema>;
