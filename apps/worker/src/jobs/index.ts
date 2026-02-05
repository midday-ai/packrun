/**
 * Job Registry
 */

import { worker as log } from "@packrun/logger";
import { createWorker } from "@packrun/queue";
import {
  type BulkSyncJobData,
  NPM_BULK_SYNC_QUEUE,
  NPM_SYNC_QUEUE,
  type SyncJobData,
} from "@packrun/queue/npm-sync";
import { createEmailDeliveryWorker } from "./email-delivery";
import { createEmailDigestWorker, initializeDigestScheduler } from "./email-digest";
import { processBulkSyncJob, processSyncJob } from "./npm-sync";

export { getCombinedStats as getQueueStats } from "./npm-sync";

export function createWorkers() {
  const syncWorker = createWorker<SyncJobData>(NPM_SYNC_QUEUE, processSyncJob, {
    concurrency: 5,
    limiter: { max: 100, duration: 60000 },
  });

  const bulkSyncWorker = createWorker<BulkSyncJobData>(NPM_BULK_SYNC_QUEUE, processBulkSyncJob, {
    concurrency: 2,
    limiter: { max: 50, duration: 60000 },
  });

  // Notification delivery workers
  const emailWorker = createEmailDeliveryWorker();
  const digestWorker = createEmailDigestWorker();

  // Initialize digest scheduler (schedules daily/weekly digest jobs)
  initializeDigestScheduler().catch((error) => {
    log.error("Failed to initialize digest scheduler:", error);
  });

  syncWorker.on("failed", (job, error) => {
    log.error(`[${job?.id}] Failed:`, error.message);
  });

  syncWorker.on("error", (error) => {
    log.error("Sync worker error:", error);
  });

  bulkSyncWorker.on("completed", (job) => {
    log.success(`[${job.id}] Bulk job completed`);
  });

  bulkSyncWorker.on("failed", (job, error) => {
    log.error(`[${job?.id}] Bulk job failed:`, error.message);
  });

  bulkSyncWorker.on("error", (error) => {
    log.error("Bulk sync worker error:", error);
  });

  emailWorker.on("failed", (job, error) => {
    log.error(`[Email ${job?.id}] Failed:`, error.message);
  });

  digestWorker.on("failed", (job, error) => {
    log.error(`[Digest ${job?.id}] Failed:`, error.message);
  });

  return {
    syncWorker,
    bulkSyncWorker,
    emailWorker,
    digestWorker,
    async close() {
      await syncWorker.close();
      await bulkSyncWorker.close();
      await emailWorker.close();
      await digestWorker.close();
    },
  };
}
