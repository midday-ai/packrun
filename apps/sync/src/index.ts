/**
 * npm Sync Worker
 *
 * Listens to npm registry changes and syncs packages to Typesense for search.
 */

import { config } from "./config";
import {
  fetchDownloads,
  fetchPackageMetadata,
  streamChanges,
  transformToDocument,
} from "./npm-client";
import { deletePackage, ensureCollection, upsertPackages } from "./typesense";

const BATCH_SIZE = config.sync.batchSize;

async function processPackage(name: string, deleted = false) {
  if (deleted) {
    await deletePackage(name);
    console.log(`Deleted: ${name}`);
    return;
  }

  // Skip design docs and internal npm stuff
  if (name.startsWith("_design/")) {
    return;
  }

  const metadata = await fetchPackageMetadata(name);
  if (!metadata) {
    console.log(`Skipped (not found): ${name}`);
    return;
  }

  const downloads = await fetchDownloads([name]);
  const downloadCount = downloads.get(name) || 0;

  // Transform to Typesense document
  const doc = transformToDocument(metadata, downloadCount);

  await upsertPackages([doc]);

  console.log(`Synced: ${name} v${doc.version} (${doc.downloads.toLocaleString()} downloads/wk)`);
}

async function runChangesListener() {
  console.log("Starting npm changes listener...");

  // Ensure Typesense collection exists
  await ensureCollection();

  // Start from "now" - we'll catch all new changes from this point
  const since = "now";
  console.log(`Listening for changes from: ${since}`);

  let batch: Array<{ id: string; deleted?: boolean }> = [];

  for await (const change of streamChanges(since)) {
    batch.push({ id: change.id, deleted: change.deleted });

    if (batch.length >= BATCH_SIZE) {
      // Process batch
      for (const item of batch) {
        try {
          await processPackage(item.id, item.deleted);
        } catch (error) {
          console.error(`Error processing ${item.id}:`, error);
        }
      }

      console.log(`Processed batch of ${batch.length}`);
      batch = [];
    }
  }

  // Process remaining
  if (batch.length > 0) {
    for (const item of batch) {
      try {
        await processPackage(item.id, item.deleted);
      } catch (error) {
        console.error(`Error processing ${item.id}:`, error);
      }
    }
  }
}

async function main() {
  console.log("npm Sync Worker starting...");
  console.log(
    `Typesense: ${config.typesense.nearestNode.host}:${config.typesense.nearestNode.port}`,
  );

  // Handle graceful shutdown
  const shutdown = async () => {
    console.log("\nShutting down...");
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  try {
    await runChangesListener();
  } catch (error) {
    console.error("Fatal error:", error);
    process.exit(1);
  }
}

main();
