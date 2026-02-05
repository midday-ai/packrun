/**
 * Worker - Processor Entry Point
 *
 * Processes jobs from the queue.
 * Run with: bun run src/worker.ts
 */

import { colors, worker as log } from "@packrun/logger";
import { getConnectionInfo } from "@packrun/queue";
import { ensureCollection } from "./clients/typesense";
import { config } from "./config";
import { createWorkers, getQueueStats } from "./jobs";

let workers: ReturnType<typeof createWorkers> | null = null;

async function logStats() {
  const stats = await getQueueStats();

  log.info(
    `Sync: ${stats.sync.waiting} waiting, ${stats.sync.active} active, ${stats.sync.failed} failed | ` +
      `Bulk: ${stats.bulk.waiting} waiting, ${stats.bulk.active} active`,
  );
}

async function shutdown() {
  log.warn("Shutting down workers...");

  if (workers) {
    await workers.close();
  }

  log.success("Workers closed");
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

async function main() {
  const redisInfo = getConnectionInfo();

  const c = colors;
  log.box({
    title: c.bold("Worker Processor"),
    message: [
      `${c.cyan("Typesense")} ${c.gray("→")} ${c.whiteBright(`${config.typesense.nearestNode.host}:${config.typesense.nearestNode.port}`)}`,
      `${c.red("Redis")}     ${c.gray("→")} ${c.whiteBright(`${redisInfo.host}:${redisInfo.port}`)}`,
    ].join("\n"),
  });

  // Ensure Typesense collection exists
  await ensureCollection();

  // Create and start workers
  workers = createWorkers();

  log.ready("Workers ready, processing jobs...");

  // Log stats every minute
  setInterval(logStats, 60000);

  // Initial stats
  await logStats();
}

main().catch((error) => {
  log.error("Fatal error:", error);
  process.exit(1);
});
