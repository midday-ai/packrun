/**
 * Test Sync Script
 *
 * Syncs a few packages to Typesense for testing search.
 *
 * Usage: bun run src/test-sync.ts
 */

import { fetchDownloads, fetchPackageMetadata, transformToDocument } from "./npm-client";
import { fetchVulnerabilities } from "./osv-client";
import { ensureCollection, upsertPackages } from "./typesense";

const TEST_PACKAGES = [
  "react",
  "typescript",
  "next",
  "zod",
  "tailwindcss",
  "lodash",
  "express",
  "axios",
  "vue",
  "svelte",
  "request", // Has known vulnerability
];

async function syncPackage(name: string): Promise<boolean> {
  console.log(`Syncing ${name}...`);

  try {
    const metadata = await fetchPackageMetadata(name);
    if (!metadata) {
      console.log(`  ❌ Not found: ${name}`);
      return false;
    }

    const downloads = await fetchDownloads([name]);
    const downloadCount = downloads.get(name) || 0;

    // Fetch vulnerabilities
    const version = metadata["dist-tags"]?.latest || "0.0.0";
    const vulns = await fetchVulnerabilities(name, version);

    console.log(
      `  📦 Fetched metadata, ${downloadCount.toLocaleString()} downloads/week, ${vulns.total} vulnerabilities`,
    );

    const doc = transformToDocument(metadata, downloadCount);

    // Add vulnerability data
    doc.vulnerabilities = vulns.total;
    doc.vulnCritical = vulns.critical;
    doc.vulnHigh = vulns.high;

    await upsertPackages([doc]);

    console.log(`  ✅ Saved to Typesense`);
    return true;
  } catch (error) {
    console.error(`  ❌ Error:`, error);
    return false;
  }
}

async function main() {
  console.log("🚀 Test Sync - Syncing packages to Typesense\n");

  await ensureCollection();

  let success = 0;
  let failed = 0;

  for (const name of TEST_PACKAGES) {
    const ok = await syncPackage(name);
    if (ok) success++;
    else failed++;
    console.log();
  }

  console.log(`\n✨ Done! ${success} synced, ${failed} failed`);
}

main();
