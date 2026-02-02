/**
 * Job Registry
 */

import { createWorker } from "@v1/queue";
import {
  type BulkSyncJobData,
  NPM_BULK_SYNC_QUEUE,
  NPM_SYNC_QUEUE,
  type SyncJobData,
} from "@v1/queue/npm-sync";
import { createBackfillWorker, getBackfillStatus } from "./backfill";
import { processBulkSyncJob, processSyncJob } from "./npm-sync";

export { getCombinedStats as getQueueStats } from "./npm-sync";
export { getBackfillStatus } from "./backfill";

export function createWorkers() {
  const syncWorker = createWorker<SyncJobData>(NPM_SYNC_QUEUE, processSyncJob, {
    concurrency: 5,
    limiter: { max: 100, duration: 60000 },
  });

  const bulkSyncWorker = createWorker<BulkSyncJobData>(NPM_BULK_SYNC_QUEUE, processBulkSyncJob, {
    concurrency: 2,
    limiter: { max: 20, duration: 60000 },
  });

  const backfillWorker = createBackfillWorker();

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
    backfillWorker,
    async close() {
      await syncWorker.close();
      await bulkSyncWorker.close();
      await backfillWorker.close();
    },
  };
}
