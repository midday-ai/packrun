/**
 * Job Registry
 *
 * Registers all job processors with BullMQ workers.
 */

import { Worker } from "bullmq";
import { connection } from "../lib/redis";
import {
  QUEUE_NAME,
  BULK_QUEUE_NAME,
  processSyncJob,
  processBulkSyncJob,
  getQueueStats,
  type SyncJobData,
  type BulkSyncJobData,
} from "./npm-sync";

// Re-export for convenience
export { getQueueStats } from "./npm-sync";
export type { SyncJobData, BulkSyncJobData } from "./npm-sync";

/**
 * Create and start all job workers
 */
export function createWorkers() {
  // npm sync worker
  const syncWorker = new Worker<SyncJobData>(QUEUE_NAME, processSyncJob, {
    connection,
    concurrency: 5,
    limiter: {
      max: 100,
      duration: 60000,
    },
  });

  // Bulk sync worker
  const bulkSyncWorker = new Worker<BulkSyncJobData>(BULK_QUEUE_NAME, processBulkSyncJob, {
    connection,
    concurrency: 2,
    limiter: {
      max: 20,
      duration: 60000,
    },
  });

  // Event handlers
  syncWorker.on("failed", (job, error) => {
    console.error(`[${job?.id}] Failed:`, error.message);
  });

  syncWorker.on("error", (error) => {
    console.error("Sync worker error:", error);
  });

  bulkSyncWorker.on("completed", (job) => {
    console.log(`[${job.id}] Bulk job completed`);
  });

  bulkSyncWorker.on("failed", (job, error) => {
    console.error(`[${job?.id}] Bulk job failed:`, error.message);
  });

  bulkSyncWorker.on("error", (error) => {
    console.error("Bulk sync worker error:", error);
  });

  return {
    syncWorker,
    bulkSyncWorker,
    async close() {
      await syncWorker.close();
      await bulkSyncWorker.close();
    },
  };
}
