/**
 * Release Detector
 *
 * Checks if a new package version matches any pending upcoming releases
 * and dispatches notifications when a release is detected as launched.
 */

import { db, isDatabaseAvailable } from "@packrun/db/client";
import {
  getPendingReleasesForPackage,
  getUsersFollowingPackage,
  getUsersFollowingRelease,
  markReleaseAsLaunched,
  type UpcomingReleaseRecord,
} from "@packrun/db/queries";
import semver from "semver";
import { queueReleaseEmail } from "./email-queue";

/**
 * Check if a new version matches an upcoming release target
 */
function versionMatches(release: UpcomingReleaseRecord, newVersion: string): boolean {
  const cleanNewVersion = semver.clean(newVersion);
  const cleanTarget = semver.clean(release.targetVersion);

  if (!cleanNewVersion) return false;

  if (release.versionMatchType === "exact") {
    // Exact match: 1.0.0 matches 1.0.0
    return cleanTarget === cleanNewVersion;
  }

  if (release.versionMatchType === "major") {
    // Major match: target 1.0.0 matches any 1.x.x
    // Also handle formats like "1.x" or "1"
    const targetMajor = semver.major(cleanTarget || "0.0.0");
    const newMajor = semver.major(cleanNewVersion);

    // If target has minor as 0, any version in that major is a match
    // e.g., target 1.0.0 matches 1.0.0, 1.1.0, 1.2.5, etc.
    return targetMajor === newMajor && semver.gte(cleanNewVersion, cleanTarget || "0.0.0");
  }

  return false;
}

/**
 * Get unique users to notify for a release launch
 * This includes:
 * - Users directly following the release
 * - Users following the package (if the release is linked to a package)
 */
async function getUniqueUsersToNotify(
  release: UpcomingReleaseRecord,
): Promise<Map<string, string>> {
  const users = new Map<string, string>(); // userId -> email

  // Get users following the release directly
  const releaseFollowers = await getUsersFollowingRelease(db!, release.id);
  for (const follower of releaseFollowers) {
    users.set(follower.userId, follower.email);
  }

  // Get users following the package (if linked)
  if (release.packageName) {
    const packageFollowers = await getUsersFollowingPackage(db!, release.packageName);
    for (const follower of packageFollowers) {
      // Only add if not already in map (dedupe)
      if (!users.has(follower.userId)) {
        users.set(follower.userId, follower.email);
      }
    }
  }

  return users;
}

/**
 * Check for pending releases that match a new version and dispatch notifications
 * Returns the number of releases that were marked as launched
 */
export async function checkAndDispatchReleases(
  packageName: string,
  newVersion: string,
): Promise<number> {
  if (!isDatabaseAvailable(db) || !db) {
    return 0;
  }

  // Get all pending releases for this package
  const pendingReleases = await getPendingReleasesForPackage(db, packageName);

  if (pendingReleases.length === 0) {
    return 0;
  }

  let matchedCount = 0;

  for (const release of pendingReleases) {
    if (versionMatches(release, newVersion)) {
      console.log(
        `[Release] Detected launch: "${release.title}" (${release.targetVersion} -> ${newVersion})`,
      );

      // Mark the release as launched
      await markReleaseAsLaunched(db, release.id, newVersion);
      matchedCount++;

      // Get users to notify
      const usersToNotify = await getUniqueUsersToNotify(release);

      // Queue emails for each user
      for (const [userId, email] of usersToNotify) {
        try {
          await queueReleaseEmail({
            userId,
            email,
            release: {
              id: release.id,
              title: release.title,
              packageName: release.packageName || undefined,
              targetVersion: release.targetVersion,
              releasedVersion: newVersion,
              description: release.description || undefined,
              websiteUrl: release.websiteUrl || undefined,
            },
          });
        } catch (error) {
          console.error(`[Release] Failed to queue email for user ${userId}:`, error);
        }
      }

      console.log(
        `[Release] Queued ${usersToNotify.size} notification(s) for release "${release.title}"`,
      );
    }
  }

  return matchedCount;
}
