/**
 * Database Queries
 *
 * Reusable query functions for the packrun.dev database.
 */

import { eq, and } from "drizzle-orm";
import type { Database } from "./client.js";
import {
  user,
  favorite,
  notification,
  notificationPreferences,
  integrationConnection,
} from "./schema.js";

// =============================================================================
// Types
// =============================================================================

export interface UserWithFavoriteAndPreferences {
  userId: string;
  email: string;
  notifyAllUpdates: boolean;
  notifyMajorOnly: boolean;
  notifySecurityOnly: boolean;
  inAppEnabled: boolean;
  slackEnabled: boolean;
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

export interface SlackIntegration {
  id: string;
  config: unknown;
}

// =============================================================================
// Queries
// =============================================================================

/**
 * Get users who favorited a package along with their notification preferences
 */
export async function getUsersWithFavoritesForPackage(
  db: Database,
  packageName: string,
): Promise<UserWithFavoriteAndPreferences[]> {
  const results = await db
    .select({
      userId: favorite.userId,
      email: user.email,
      notifyAllUpdates: notificationPreferences.notifyAllUpdates,
      notifyMajorOnly: notificationPreferences.notifyMajorOnly,
      notifySecurityOnly: notificationPreferences.notifySecurityOnly,
      inAppEnabled: notificationPreferences.inAppEnabled,
      slackEnabled: notificationPreferences.slackEnabled,
      emailDigestEnabled: notificationPreferences.emailDigestEnabled,
      emailImmediateCritical: notificationPreferences.emailImmediateCritical,
    })
    .from(favorite)
    .innerJoin(user, eq(favorite.userId, user.id))
    .leftJoin(notificationPreferences, eq(favorite.userId, notificationPreferences.userId))
    .where(eq(favorite.packageName, packageName));

  return results.map((row) => ({
    userId: row.userId,
    email: row.email,
    // Apply defaults for users without preferences
    notifyAllUpdates: row.notifyAllUpdates ?? false,
    notifyMajorOnly: row.notifyMajorOnly ?? true,
    notifySecurityOnly: row.notifySecurityOnly ?? true,
    inAppEnabled: row.inAppEnabled ?? true,
    slackEnabled: row.slackEnabled ?? false,
    emailDigestEnabled: row.emailDigestEnabled ?? false,
    emailImmediateCritical: row.emailImmediateCritical ?? true,
  }));
}

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
 * Get a user's Slack integration
 */
export async function getSlackIntegration(
  db: Database,
  userId: string,
): Promise<SlackIntegration | null> {
  const results = await db
    .select({
      id: integrationConnection.id,
      config: integrationConnection.config,
    })
    .from(integrationConnection)
    .where(
      and(
        eq(integrationConnection.userId, userId),
        eq(integrationConnection.provider, "slack"),
        eq(integrationConnection.enabled, true),
      ),
    )
    .limit(1);

  return results[0] ?? null;
}
