/**
 * Notification Dispatcher
 *
 * Creates notifications for users who follow a package and
 * dispatches to appropriate channels (in-app, email).
 */

import { db } from "@packrun/db/client";
import {
  getUsersFollowingPackage,
  insertNotification,
  type UserWithFollowAndPreferences,
} from "@packrun/db/queries";
import { getQueue } from "@packrun/queue";
import {
  EMAIL_DELIVERY_QUEUE,
  type EmailDeliveryJobData,
  EXTERNAL_API_RETRY,
} from "@packrun/queue/delivery";
import { createId } from "@paralleldrive/cuid2";
import type { NotificationEnrichment } from "./notification-enrichment";

// =============================================================================
// Types
// =============================================================================

interface NotificationData {
  packageName: string;
  newVersion: string;
  previousVersion: string | null;
  severity: "critical" | "important" | "info";
  isSecurityUpdate: boolean;
  isBreakingChange: boolean;
  changelogSnippet: string | null;
  vulnerabilitiesFixed: number | null;
}

// =============================================================================
// Helpers
// =============================================================================

/**
 * Check if user wants to be notified based on their preferences
 */
function shouldNotifyUser(
  prefs: UserWithFollowAndPreferences,
  severity: string,
  isSecurityUpdate: boolean,
): boolean {
  if (prefs.notifyAllUpdates) return true;
  if (prefs.notifySecurityOnly && isSecurityUpdate) return true;
  if (prefs.notifyMajorOnly && severity !== "info") return true;

  return false;
}

// =============================================================================
// Main Dispatcher
// =============================================================================

/**
 * Dispatch notifications for a package update
 *
 * 1. Find all users who follow the package
 * 2. Filter by user preferences
 * 3. Create in-app notifications
 * 4. Queue immediate emails (critical only)
 */
export async function dispatchNotifications(
  packageName: string,
  enrichment: NotificationEnrichment,
  previousVersion: string | null,
  newVersion: string,
): Promise<{ notified: number; skipped: number }> {
  if (!db) {
    console.log(`[Dispatcher] Database not available, skipping notifications for ${packageName}`);
    return { notified: 0, skipped: 0 };
  }

  const notificationData: NotificationData = {
    packageName,
    newVersion,
    previousVersion,
    severity: enrichment.severity,
    isSecurityUpdate: enrichment.securityAnalysis.isSecurityUpdate,
    isBreakingChange: enrichment.versionAnalysis.isBreakingChange,
    changelogSnippet: enrichment.changelogSnippet,
    vulnerabilitiesFixed: enrichment.securityAnalysis.vulnerabilitiesFixed || null,
  };

  try {
    // Find users who follow this package along with their preferences
    const usersFollowing = await getUsersFollowingPackage(db, packageName);

    if (usersFollowing.length === 0) {
      return { notified: 0, skipped: 0 };
    }

    let notified = 0;
    let skipped = 0;

    // Process each user
    for (const userPrefs of usersFollowing) {
      // Check if user wants this notification
      if (
        !shouldNotifyUser(userPrefs, notificationData.severity, notificationData.isSecurityUpdate)
      ) {
        skipped++;
        continue;
      }

      // Create in-app notification (if enabled)
      if (userPrefs.inAppEnabled) {
        await createInAppNotification(userPrefs.userId, notificationData);
      }

      // Queue immediate email for critical notifications
      if (userPrefs.emailImmediateCritical && notificationData.severity === "critical") {
        await queueImmediateEmail(userPrefs.userId, userPrefs.email, notificationData);
      }

      notified++;
    }

    console.log(
      `[Dispatcher] ${packageName}@${newVersion}: ${notified} notified, ${skipped} skipped (severity: ${notificationData.severity})`,
    );

    return { notified, skipped };
  } catch (error) {
    console.error(`[Dispatcher] Error dispatching notifications for ${packageName}:`, error);
    return { notified: 0, skipped: 0 };
  }
}

// =============================================================================
// Channel-specific Functions
// =============================================================================

/**
 * Create in-app notification record
 */
async function createInAppNotification(userId: string, data: NotificationData): Promise<void> {
  if (!db) return;

  try {
    await insertNotification(db, {
      id: createId(),
      userId,
      packageName: data.packageName,
      newVersion: data.newVersion,
      previousVersion: data.previousVersion,
      severity: data.severity,
      isSecurityUpdate: data.isSecurityUpdate,
      isBreakingChange: data.isBreakingChange,
      changelogSnippet: data.changelogSnippet,
      vulnerabilitiesFixed: data.vulnerabilitiesFixed,
    });
  } catch (error) {
    console.error(`[Dispatcher] Error creating in-app notification:`, error);
  }
}

/**
 * Queue immediate email for critical notifications
 */
async function queueImmediateEmail(
  userId: string,
  email: string,
  data: NotificationData,
): Promise<void> {
  try {
    const emailQueue = getQueue<EmailDeliveryJobData>({ name: EMAIL_DELIVERY_QUEUE });

    await emailQueue.add(
      "send",
      {
        to: email,
        userId,
        template: "critical-alert",
        props: {
          packageName: data.packageName,
          newVersion: data.newVersion,
          previousVersion: data.previousVersion || undefined,
          vulnerabilitiesFixed: data.vulnerabilitiesFixed || 0,
          changelogSnippet: data.changelogSnippet || undefined,
        },
      },
      {
        ...EXTERNAL_API_RETRY,
        jobId: `email-${userId}-${data.packageName}-${data.newVersion}`,
      },
    );
  } catch (error) {
    console.error(`[Dispatcher] Error queuing email:`, error);
  }
}
