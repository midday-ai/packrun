/**
 * Database Queries
 *
 * Reusable query functions for the packrun.dev database.
 */

import { and, desc, eq, sql } from "drizzle-orm";
import type { Database } from "./client";
import {
  notification,
  notificationPreferences,
  packageFollow,
  releaseFollow,
  upcomingRelease,
  user,
} from "./schema";

// =============================================================================
// Types
// =============================================================================

export interface UserWithFollowAndPreferences {
  userId: string;
  email: string;
  notifyAllUpdates: boolean;
  notifyMajorOnly: boolean;
  notifySecurityOnly: boolean;
  inAppEnabled: boolean;
  emailDigestEnabled: boolean;
  emailImmediateCritical: boolean;
}

export interface NotificationInsert {
  id: string;
  userId: string;
  packageName: string;
  newVersion: string;
  previousVersion: string | null;
  severity: "critical" | "important" | "info";
  isSecurityUpdate: boolean;
  isBreakingChange: boolean;
  changelogSnippet: string | null;
  vulnerabilitiesFixed: number | null;
}

export interface NotificationRecord {
  id: string;
  packageName: string;
  newVersion: string;
  previousVersion: string | null;
  severity: "critical" | "important" | "info";
  isSecurityUpdate: boolean;
  isBreakingChange: boolean;
  changelogSnippet: string | null;
  vulnerabilitiesFixed: number | null;
  read: boolean;
  createdAt: Date;
}

export interface NotificationListOptions {
  severity?: string[];
  unreadOnly?: boolean;
  limit?: number;
  offset?: number;
}

export interface NotificationPreferencesData {
  notifyAllUpdates?: boolean;
  notifyMajorOnly?: boolean;
  notifySecurityOnly?: boolean;
  inAppEnabled?: boolean;
  emailDigestEnabled?: boolean;
  emailDigestFrequency?: string | null;
  emailImmediateCritical?: boolean;
}

// =============================================================================
// User Queries
// =============================================================================

/**
 * Get users who follow a package along with their notification preferences
 */
export async function getUsersFollowingPackage(
  db: Database,
  packageName: string,
): Promise<UserWithFollowAndPreferences[]> {
  const results = await db
    .select({
      userId: packageFollow.userId,
      email: user.email,
      notifyAllUpdates: notificationPreferences.notifyAllUpdates,
      notifyMajorOnly: notificationPreferences.notifyMajorOnly,
      notifySecurityOnly: notificationPreferences.notifySecurityOnly,
      inAppEnabled: notificationPreferences.inAppEnabled,
      emailDigestEnabled: notificationPreferences.emailDigestEnabled,
      emailImmediateCritical: notificationPreferences.emailImmediateCritical,
    })
    .from(packageFollow)
    .innerJoin(user, eq(packageFollow.userId, user.id))
    .leftJoin(notificationPreferences, eq(packageFollow.userId, notificationPreferences.userId))
    .where(eq(packageFollow.packageName, packageName));

  return results.map((row) => ({
    userId: row.userId,
    email: row.email,
    // Apply defaults for users without preferences
    notifyAllUpdates: row.notifyAllUpdates ?? false,
    notifyMajorOnly: row.notifyMajorOnly ?? true,
    notifySecurityOnly: row.notifySecurityOnly ?? true,
    inAppEnabled: row.inAppEnabled ?? true,
    emailDigestEnabled: row.emailDigestEnabled ?? false,
    emailImmediateCritical: row.emailImmediateCritical ?? true,
  }));
}

/**
 * Delete a user and cascade to all related data
 */
export async function deleteUser(db: Database, userId: string): Promise<void> {
  await db.delete(user).where(eq(user.id, userId));
}

// =============================================================================
// Package Follow Queries
// =============================================================================

/**
 * Get user's followed packages
 */
export async function listFollowedPackages(db: Database, userId: string): Promise<string[]> {
  const results = await db
    .select({ packageName: packageFollow.packageName })
    .from(packageFollow)
    .where(eq(packageFollow.userId, userId))
    .orderBy(packageFollow.createdAt);

  return results.map((f) => f.packageName);
}

/**
 * Follow a package (ignores duplicates)
 */
export async function followPackage(
  db: Database,
  id: string,
  userId: string,
  packageName: string,
): Promise<void> {
  await db.insert(packageFollow).values({ id, userId, packageName }).onConflictDoNothing();
}

/**
 * Unfollow a package
 */
export async function unfollowPackage(
  db: Database,
  userId: string,
  packageName: string,
): Promise<void> {
  await db
    .delete(packageFollow)
    .where(and(eq(packageFollow.userId, userId), eq(packageFollow.packageName, packageName)));
}

/**
 * Check if user is following a package
 */
export async function isFollowingPackage(
  db: Database,
  userId: string,
  packageName: string,
): Promise<boolean> {
  const result = await db
    .select({ id: packageFollow.id })
    .from(packageFollow)
    .where(and(eq(packageFollow.userId, userId), eq(packageFollow.packageName, packageName)))
    .limit(1);

  return result.length > 0;
}

// =============================================================================
// Notification Queries
// =============================================================================

/**
 * Insert a notification record (ignores duplicates)
 */
export async function insertNotification(db: Database, data: NotificationInsert): Promise<void> {
  await db
    .insert(notification)
    .values({
      id: data.id,
      userId: data.userId,
      packageName: data.packageName,
      newVersion: data.newVersion,
      previousVersion: data.previousVersion,
      severity: data.severity,
      isSecurityUpdate: data.isSecurityUpdate,
      isBreakingChange: data.isBreakingChange,
      changelogSnippet: data.changelogSnippet,
      vulnerabilitiesFixed: data.vulnerabilitiesFixed,
      read: false,
    })
    .onConflictDoNothing({
      target: [notification.userId, notification.packageName, notification.newVersion],
    });
}

/**
 * List notifications with filtering and pagination
 */
export async function listNotifications(
  db: Database,
  userId: string,
  options: NotificationListOptions = {},
): Promise<{ notifications: NotificationRecord[]; total: number; unreadCount: number }> {
  const { severity, unreadOnly, limit = 20, offset = 0 } = options;

  // Build query conditions
  const conditions = [eq(notification.userId, userId)];

  if (unreadOnly) {
    conditions.push(eq(notification.read, false));
  }

  if (severity && severity.length > 0) {
    conditions.push(sql`${notification.severity} = ANY(${severity})`);
  }

  // Get notifications
  const notifications = await db
    .select()
    .from(notification)
    .where(and(...conditions))
    .orderBy(desc(notification.createdAt))
    .limit(limit)
    .offset(offset);

  // Get total and unread counts
  const [countResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(notification)
    .where(eq(notification.userId, userId));

  const [unreadResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(notification)
    .where(and(eq(notification.userId, userId), eq(notification.read, false)));

  return {
    notifications: notifications.map((n) => ({
      id: n.id,
      packageName: n.packageName,
      newVersion: n.newVersion,
      previousVersion: n.previousVersion,
      severity: n.severity as "critical" | "important" | "info",
      isSecurityUpdate: n.isSecurityUpdate,
      isBreakingChange: n.isBreakingChange,
      changelogSnippet: n.changelogSnippet,
      vulnerabilitiesFixed: n.vulnerabilitiesFixed,
      read: n.read,
      createdAt: n.createdAt,
    })),
    total: Number(countResult?.count || 0),
    unreadCount: Number(unreadResult?.count || 0),
  };
}

/**
 * Get unread notification counts
 */
export async function getUnreadCount(
  db: Database,
  userId: string,
): Promise<{ total: number; critical: number }> {
  const [totalResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(notification)
    .where(and(eq(notification.userId, userId), eq(notification.read, false)));

  const [criticalResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(notification)
    .where(
      and(
        eq(notification.userId, userId),
        eq(notification.read, false),
        eq(notification.severity, "critical"),
      ),
    );

  return {
    total: Number(totalResult?.count || 0),
    critical: Number(criticalResult?.count || 0),
  };
}

/**
 * Mark a single notification as read
 */
export async function markNotificationRead(
  db: Database,
  userId: string,
  notificationId: string,
): Promise<void> {
  await db
    .update(notification)
    .set({ read: true })
    .where(and(eq(notification.id, notificationId), eq(notification.userId, userId)));
}

/**
 * Mark all notifications as read
 */
export async function markAllNotificationsRead(db: Database, userId: string): Promise<void> {
  await db
    .update(notification)
    .set({ read: true })
    .where(and(eq(notification.userId, userId), eq(notification.read, false)));
}

/**
 * Get notification preferences for a user (returns defaults if none exist)
 */
export async function getNotificationPreferences(
  db: Database,
  userId: string,
): Promise<NotificationPreferencesData> {
  const [prefs] = await db
    .select()
    .from(notificationPreferences)
    .where(eq(notificationPreferences.userId, userId))
    .limit(1);

  // Return defaults if no preferences exist
  return (
    prefs || {
      notifyAllUpdates: false,
      notifyMajorOnly: true,
      notifySecurityOnly: true,
      inAppEnabled: true,
      emailDigestEnabled: false,
      emailDigestFrequency: "daily",
      emailImmediateCritical: true,
    }
  );
}

/**
 * Create or update notification preferences
 */
export async function upsertNotificationPreferences(
  db: Database,
  id: string,
  userId: string,
  data: NotificationPreferencesData,
): Promise<NotificationPreferencesData> {
  const [existing] = await db
    .select()
    .from(notificationPreferences)
    .where(eq(notificationPreferences.userId, userId))
    .limit(1);

  let updated;
  if (existing) {
    [updated] = await db
      .update(notificationPreferences)
      .set(data)
      .where(eq(notificationPreferences.userId, userId))
      .returning();
  } else {
    [updated] = await db
      .insert(notificationPreferences)
      .values({ id, userId, ...data })
      .returning();
  }

  return {
    notifyAllUpdates: updated!.notifyAllUpdates,
    notifyMajorOnly: updated!.notifyMajorOnly,
    notifySecurityOnly: updated!.notifySecurityOnly,
    inAppEnabled: updated!.inAppEnabled,
    emailDigestEnabled: updated!.emailDigestEnabled,
    emailDigestFrequency: updated!.emailDigestFrequency,
    emailImmediateCritical: updated!.emailImmediateCritical,
  };
}

/**
 * Disable email notifications for a user (for unsubscribe)
 */
export async function disableEmailNotifications(
  db: Database,
  id: string,
  userId: string,
): Promise<boolean> {
  try {
    const [existing] = await db
      .select()
      .from(notificationPreferences)
      .where(eq(notificationPreferences.userId, userId))
      .limit(1);

    if (existing) {
      await db
        .update(notificationPreferences)
        .set({
          emailDigestEnabled: false,
          emailImmediateCritical: false,
        })
        .where(eq(notificationPreferences.userId, userId));
    } else {
      await db.insert(notificationPreferences).values({
        id,
        userId,
        emailDigestEnabled: false,
        emailImmediateCritical: false,
      });
    }

    return true;
  } catch (error) {
    console.error("[DB] Error disabling email notifications:", error);
    return false;
  }
}

// =============================================================================
// Upcoming Release Queries
// =============================================================================

export interface UpcomingReleaseRecord {
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
}

export interface UpcomingReleaseInsert {
  id: string;
  packageName?: string | null;
  title: string;
  description?: string | null;
  targetVersion: string;
  versionMatchType: "exact" | "major";
  logoUrl?: string | null;
  websiteUrl?: string | null;
  expectedDate?: Date | null;
  submittedById: string;
  featured?: boolean;
}

export interface ListReleasesOptions {
  status?: "upcoming" | "released";
  packageName?: string;
  featured?: boolean;
  limit?: number;
  offset?: number;
}

/**
 * Create a new upcoming release
 */
export async function createUpcomingRelease(
  db: Database,
  data: UpcomingReleaseInsert,
): Promise<UpcomingReleaseRecord> {
  const [release] = await db
    .insert(upcomingRelease)
    .values({
      ...data,
      status: "upcoming",
    })
    .returning();

  return release as UpcomingReleaseRecord;
}

/**
 * Get a single upcoming release by ID
 */
export async function getUpcomingRelease(
  db: Database,
  id: string,
): Promise<UpcomingReleaseRecord | null> {
  const [release] = await db
    .select()
    .from(upcomingRelease)
    .where(eq(upcomingRelease.id, id))
    .limit(1);

  return (release as UpcomingReleaseRecord) || null;
}

/**
 * List upcoming releases with filters
 */
export async function listUpcomingReleases(
  db: Database,
  options: ListReleasesOptions = {},
): Promise<{ releases: UpcomingReleaseRecord[]; total: number }> {
  const { status, packageName, featured, limit = 20, offset = 0 } = options;

  const conditions = [];

  if (status) {
    conditions.push(eq(upcomingRelease.status, status));
  }

  if (packageName) {
    conditions.push(eq(upcomingRelease.packageName, packageName));
  }

  if (featured !== undefined) {
    conditions.push(eq(upcomingRelease.featured, featured));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const releases = await db
    .select()
    .from(upcomingRelease)
    .where(whereClause)
    .orderBy(desc(upcomingRelease.createdAt))
    .limit(limit)
    .offset(offset);

  const [countResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(upcomingRelease)
    .where(whereClause);

  return {
    releases: releases as UpcomingReleaseRecord[],
    total: Number(countResult?.count || 0),
  };
}

/**
 * Get featured releases for homepage
 */
export async function getFeaturedReleases(
  db: Database,
  limit = 4,
): Promise<UpcomingReleaseRecord[]> {
  const releases = await db
    .select()
    .from(upcomingRelease)
    .where(and(eq(upcomingRelease.featured, true), eq(upcomingRelease.status, "upcoming")))
    .orderBy(desc(upcomingRelease.createdAt))
    .limit(limit);

  return releases as UpcomingReleaseRecord[];
}

/**
 * Get pending releases for a package (for auto-detection)
 */
export async function getPendingReleasesForPackage(
  db: Database,
  packageName: string,
): Promise<UpcomingReleaseRecord[]> {
  const releases = await db
    .select()
    .from(upcomingRelease)
    .where(
      and(eq(upcomingRelease.packageName, packageName), eq(upcomingRelease.status, "upcoming")),
    );

  return releases as UpcomingReleaseRecord[];
}

/**
 * Mark a release as launched
 */
export async function markReleaseAsLaunched(
  db: Database,
  releaseId: string,
  releasedVersion: string,
): Promise<void> {
  await db
    .update(upcomingRelease)
    .set({
      status: "released",
      releasedVersion,
      releasedAt: new Date(),
    })
    .where(eq(upcomingRelease.id, releaseId));
}

/**
 * Update an upcoming release
 */
export async function updateUpcomingRelease(
  db: Database,
  id: string,
  data: Partial<UpcomingReleaseInsert>,
): Promise<UpcomingReleaseRecord | null> {
  const [updated] = await db
    .update(upcomingRelease)
    .set(data)
    .where(eq(upcomingRelease.id, id))
    .returning();

  return (updated as UpcomingReleaseRecord) || null;
}

/**
 * Delete an upcoming release
 */
export async function deleteUpcomingRelease(db: Database, id: string): Promise<void> {
  await db.delete(upcomingRelease).where(eq(upcomingRelease.id, id));
}

// =============================================================================
// Release Follow Queries
// =============================================================================

/**
 * Follow a release
 */
export async function followRelease(
  db: Database,
  id: string,
  userId: string,
  releaseId: string,
): Promise<void> {
  await db.insert(releaseFollow).values({ id, userId, releaseId }).onConflictDoNothing();
}

/**
 * Unfollow a release
 */
export async function unfollowRelease(
  db: Database,
  userId: string,
  releaseId: string,
): Promise<void> {
  await db
    .delete(releaseFollow)
    .where(and(eq(releaseFollow.userId, userId), eq(releaseFollow.releaseId, releaseId)));
}

/**
 * Check if user is following a release
 */
export async function isFollowingRelease(
  db: Database,
  userId: string,
  releaseId: string,
): Promise<boolean> {
  const result = await db
    .select({ id: releaseFollow.id })
    .from(releaseFollow)
    .where(and(eq(releaseFollow.userId, userId), eq(releaseFollow.releaseId, releaseId)))
    .limit(1);

  return result.length > 0;
}

/**
 * Get users following a release (for notifications)
 */
export async function getUsersFollowingRelease(
  db: Database,
  releaseId: string,
): Promise<{ userId: string; email: string }[]> {
  const results = await db
    .select({
      userId: releaseFollow.userId,
      email: user.email,
    })
    .from(releaseFollow)
    .innerJoin(user, eq(releaseFollow.userId, user.id))
    .where(eq(releaseFollow.releaseId, releaseId));

  return results;
}

/**
 * Get follower count for a release
 */
export async function getReleaseFollowerCount(db: Database, releaseId: string): Promise<number> {
  const [result] = await db
    .select({ count: sql<number>`count(*)` })
    .from(releaseFollow)
    .where(eq(releaseFollow.releaseId, releaseId));

  return Number(result?.count || 0);
}
