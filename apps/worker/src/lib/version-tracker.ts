/**
 * Version Tracker
 *
 * Queries Typesense to get the current indexed version of a package
 * before it gets updated. This allows us to detect version changes.
 */

import { typesenseClient } from "../clients";

/**
 * Get the currently indexed version of a package from Typesense
 */
export async function getPreviousVersion(packageName: string): Promise<string | null> {
  try {
    const doc = await typesenseClient.collections("packages").documents(packageName).retrieve();

    return (doc as { version?: string }).version || null;
  } catch (error) {
    // Package not indexed yet - this is normal for new packages
    if ((error as { httpStatus?: number }).httpStatus === 404) {
      return null;
    }

    console.error(`[VersionTracker] Error fetching version for ${packageName}:`, error);
    return null;
  }
}

/**
 * Get the repository URL from Typesense document
 */
export async function getPackageRepository(packageName: string): Promise<string | null> {
  try {
    const doc = await typesenseClient.collections("packages").documents(packageName).retrieve();

    return (doc as { repository?: string }).repository || null;
  } catch {
    return null;
  }
}
