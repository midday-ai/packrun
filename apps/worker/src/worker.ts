/**
 * Worker - Processor Entry Point
 *
 * Processes jobs from the queue.
 * Run with: bun run src/worker.ts
 */

import { getConnectionInfo } from "@v1/queue";
import { ensureCollection } from "./clients/typesense";
import { config } from "./config";
import { createWorkers, getQueueStats } from "./jobs";

let workers: ReturnType<typeof createWorkers> | null = null;

async function logStats() {
  const stats = await getQueueStats();
  console.log(
    `[Stats] Sync: ${stats.sync.waiting} waiting, ${stats.sync.active} active, ${stats.sync.failed} failed | ` +
      `Bulk: ${stats.bulk.waiting} waiting, ${stats.bulk.active} active`,
  );
}

async function shutdown() {
  console.log("\nShutting down workers...");

  if (workers) {
    await workers.close();
  }

  console.log("Workers closed");
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

async function main() {
  console.log("Worker Processor starting...");
  console.log(
    `Typesense: ${config.typesense.nearestNode.host}:${config.typesense.nearestNode.port}`,
  );
  console.log(
    `Typesense API Key: ${config.typesense.apiKey ? `${config.typesense.apiKey.slice(0, 4)}...${config.typesense.apiKey.slice(-4)}` : "(empty)"}`,
  );
  const redisInfo = getConnectionInfo();
  console.log(`Redis: ${redisInfo.host}:${redisInfo.port}`);

  // Ensure Typesense collection exists
  await ensureCollection();

  // Create and start workers
  workers = createWorkers();

  console.log("Workers ready, processing jobs...");

  // Log stats every minute
  setInterval(logStats, 60000);

  // Initial stats
  await logStats();
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
