/**
 * Bulk Sync Script
 *
 * Performs initial sync of all npm packages to Typesense for search.
 *
 * Usage: bun run bulk
 */

import {
  ensureCollection,
  fetchDownloads,
  fetchPackageMetadata,
  getDocument,
  type PackageDocument,
  upsertPackages,
} from "./clients";
import { config } from "./config";
import { transformToDocument } from "./jobs/npm-sync/processor";

const BATCH_SIZE = 100;
const CONCURRENT_FETCHES = 10;

interface AllDocsResponse {
  total_rows: number;
  offset: number;
  rows: Array<{ id: string }>;
}

async function getAllPackageNames(): Promise<string[]> {
  console.log("Fetching all package names from npm registry...");

  const response = await fetch(`${config.npm.replicateUrl}/_all_docs?include_docs=false`);
  if (!response.ok) {
    throw new Error(`Failed to fetch all docs: ${response.status}`);
  }

  const data = (await response.json()) as AllDocsResponse;
  console.log(`Found ${data.total_rows.toLocaleString()} total packages`);

  const packages = data.rows.map((row) => row.id).filter((id) => !id.startsWith("_design/"));

  console.log(`${packages.length.toLocaleString()} packages after filtering`);
  return packages;
}

async function isSynced(name: string): Promise<boolean> {
  try {
    const doc = await getDocument(name);
    return doc !== null;
  } catch {
    return false;
  }
}

async function processBatch(names: string[]): Promise<number> {
  const metadataPromises = names.map((name) => fetchPackageMetadata(name));
  const metadataResults = await Promise.all(metadataPromises);

  const validPackages = metadataResults.filter((m): m is NonNullable<typeof m> => m !== null);

  if (validPackages.length === 0) {
    return 0;
  }

  const packageNames = validPackages.map((p) => p.name);
  const downloads = await fetchDownloads(packageNames);

  const documents: PackageDocument[] = validPackages.map((metadata) =>
    transformToDocument(metadata, downloads.get(metadata.name) || 0),
  );

  await upsertPackages(documents);

  return documents.length;
}

async function runBulkSync() {
  console.log("Starting bulk sync...");
  console.log(`Batch size: ${BATCH_SIZE}, Concurrency: ${CONCURRENT_FETCHES}`);

  await ensureCollection();

  const allPackages = await getAllPackageNames();

  console.log("Checking for already synced packages...");
  const sampleSize = Math.min(1000, allPackages.length);
  let alreadySyncedEstimate = 0;

  for (let i = 0; i < sampleSize; i++) {
    if (await isSynced(allPackages[i]!)) {
      alreadySyncedEstimate++;
    }
  }

  const estimatedSyncedPercent = (alreadySyncedEstimate / sampleSize) * 100;
  console.log(
    `Estimated ${estimatedSyncedPercent.toFixed(1)}% already synced (from sample of ${sampleSize})`,
  );

  let processed = 0;
  const startTime = Date.now();

  for (let i = 0; i < allPackages.length; i += BATCH_SIZE) {
    const batch = allPackages.slice(i, i + BATCH_SIZE);

    try {
      const synced = await processBatch(batch);
      processed += synced;

      const elapsed = (Date.now() - startTime) / 1000;
      const rate = processed / elapsed;
      const remaining = allPackages.length - i - batch.length;
      const eta = remaining / rate;

      console.log(
        `Progress: ${processed.toLocaleString()}/${allPackages.length.toLocaleString()} ` +
          `(${((i / allPackages.length) * 100).toFixed(1)}%) ` +
          `Rate: ${rate.toFixed(1)}/s, ETA: ${formatDuration(eta)}`,
      );
    } catch (error) {
      console.error(`Error processing batch at ${i}:`, error);
    }

    await sleep(100);
  }

  console.log(`\nBulk sync complete!`);
  console.log(`Total synced: ${processed.toLocaleString()} packages`);
  console.log(`Duration: ${formatDuration((Date.now() - startTime) / 1000)}`);
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds.toFixed(0)}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${Math.floor(seconds % 60)}s`;
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  try {
    await runBulkSync();
  } catch (error) {
    console.error("Fatal error:", error);
    process.exit(1);
  }
}

main();
