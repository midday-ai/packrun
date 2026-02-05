/**
 * Test Notification Script
 *
 * Syncs a package and triggers notifications for users who follow it.
 *
 * Usage: bun run src/test-notify.ts ai
 */

import { fetchDownloads, fetchPackageMetadata } from "./clients";
import { fetchVulnerabilities } from "./clients/osv";
import { dispatchNotifications } from "./lib/notification-dispatcher";
import { enrichPackageUpdate } from "./lib/notification-enrichment";
import { getPreviousVersion } from "./lib/version-tracker";

const packageName = process.argv[2] || "ai";

async function main() {
  console.log(`🔔 Testing notifications for: ${packageName}\n`);

  // Fetch package metadata
  console.log("1. Fetching package metadata...");
  const metadata = await fetchPackageMetadata(packageName);
  if (!metadata) {
    console.error(`❌ Package not found: ${packageName}`);
    process.exit(1);
  }

  const latestVersion = metadata["dist-tags"]?.latest || "0.0.0";
  console.log(`   Latest version: ${latestVersion}`);

  // Get previous version (if tracked)
  const previousVersion = await getPreviousVersion(packageName);
  console.log(`   Previous version: ${previousVersion || "(none tracked)"}`);

  // Fetch downloads
  console.log("\n2. Fetching downloads...");
  const downloads = await fetchDownloads([packageName]);
  const downloadCount = downloads.get(packageName) || 0;
  console.log(`   Weekly downloads: ${downloadCount.toLocaleString()}`);

  // Fetch vulnerabilities
  console.log("\n3. Checking vulnerabilities...");
  const vulns = await fetchVulnerabilities(packageName, latestVersion);
  console.log(
    `   Vulnerabilities: ${vulns.total} (${vulns.critical} critical, ${vulns.high} high)`,
  );

  // Enrich notification data
  console.log("\n4. Enriching notification data...");
  const enrichment = await enrichPackageUpdate(
    packageName,
    previousVersion || undefined,
    latestVersion,
    metadata.repository,
  );
  console.log(`   Severity: ${enrichment.severity}`);
  console.log(`   Security update: ${enrichment.securityAnalysis.isSecurityUpdate}`);
  console.log(`   Breaking change: ${enrichment.versionAnalysis.isBreakingChange}`);
  if (enrichment.changelogSnippet) {
    console.log(`   Changelog: ${enrichment.changelogSnippet.slice(0, 100)}...`);
  }

  // Dispatch notifications
  console.log("\n5. Dispatching notifications...");
  const result = await dispatchNotifications(
    packageName,
    enrichment,
    previousVersion,
    latestVersion,
  );
  console.log(`   Notified: ${result.notified} users`);
  console.log(`   Skipped: ${result.skipped} users`);

  console.log(`\n✅ Done!`);
}

main().catch(console.error);
