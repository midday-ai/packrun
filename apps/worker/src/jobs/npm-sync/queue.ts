/**
 * npm Sync Queue
 *
 * BullMQ queue configuration for npm package sync jobs.
 */

import { Queue } from "bullmq";
import { connection } from "../../lib/redis";
import type { SyncJobData, BulkSyncJobData } from "./types";

export const QUEUE_NAME = "npm-sync";
export const BULK_QUEUE_NAME = "npm-bulk-sync";

// Main sync queue for npm changes
export const syncQueue = new Queue<SyncJobData>(QUEUE_NAME, {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 2000, // 2s, 4s, 8s
    },
    removeOnComplete: {
      count: 1000, // Keep last 1000 completed jobs
    },
    removeOnFail: {
      count: 5000, // Keep last 5000 failed jobs for review
    },
  },
});

// Bulk sync queue for initial/priority sync
export const bulkSyncQueue = new Queue<BulkSyncJobData>(BULK_QUEUE_NAME, {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 5000, // 5s, 10s, 20s (longer for bulk)
    },
    removeOnComplete: {
      count: 100,
    },
    removeOnFail: {
      count: 1000,
    },
  },
});

// Queue error handlers
syncQueue.on("error", (error: Error) => {
  console.error("Sync queue error:", error);
});

bulkSyncQueue.on("error", (error: Error) => {
  console.error("Bulk sync queue error:", error);
});

/**
 * Get queue statistics
 */
export async function getQueueStats() {
  const [syncWaiting, syncActive, syncCompleted, syncFailed] = await Promise.all([
    syncQueue.getWaitingCount(),
    syncQueue.getActiveCount(),
    syncQueue.getCompletedCount(),
    syncQueue.getFailedCount(),
  ]);

  const [bulkWaiting, bulkActive, bulkCompleted, bulkFailed] = await Promise.all([
    bulkSyncQueue.getWaitingCount(),
    bulkSyncQueue.getActiveCount(),
    bulkSyncQueue.getCompletedCount(),
    bulkSyncQueue.getFailedCount(),
  ]);

  return {
    sync: {
      waiting: syncWaiting,
      active: syncActive,
      completed: syncCompleted,
      failed: syncFailed,
    },
    bulk: {
      waiting: bulkWaiting,
      active: bulkActive,
      completed: bulkCompleted,
      failed: bulkFailed,
    },
  };
}
