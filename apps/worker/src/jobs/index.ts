/**
 * Job Registry
 */

import { createWorker } from "@packrun/queue";
import {
  type BulkSyncJobData,
  NPM_BULK_SYNC_QUEUE,
  NPM_SYNC_QUEUE,
  type SyncJobData,
} from "@packrun/queue/npm-sync";
import { processBulkSyncJob, processSyncJob } from "./npm-sync";
import { createSlackDeliveryWorker } from "./slack-delivery";
import { createEmailDeliveryWorker } from "./email-delivery";
import { createEmailDigestWorker, initializeDigestScheduler } from "./email-digest";

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
  const slackWorker = createSlackDeliveryWorker();
  const emailWorker = createEmailDeliveryWorker();
  const digestWorker = createEmailDigestWorker();

  // Initialize digest scheduler (schedules daily/weekly digest jobs)
  initializeDigestScheduler().catch((error) => {
    console.error("Failed to initialize digest scheduler:", error);
  });

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

  slackWorker.on("failed", (job, error) => {
    console.error(`[Slack ${job?.id}] Failed:`, error.message);
  });

  emailWorker.on("failed", (job, error) => {
    console.error(`[Email ${job?.id}] Failed:`, error.message);
  });

  digestWorker.on("failed", (job, error) => {
    console.error(`[Digest ${job?.id}] Failed:`, error.message);
  });

  return {
    syncWorker,
    bulkSyncWorker,
    slackWorker,
    emailWorker,
    digestWorker,
    async close() {
      await syncWorker.close();
      await bulkSyncWorker.close();
      await slackWorker.close();
      await emailWorker.close();
      await digestWorker.close();
    },
  };
}
