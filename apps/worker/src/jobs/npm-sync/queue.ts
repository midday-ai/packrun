/**
 * npm Sync Queue Instances
 */

import { getQueue, getQueueStats, JOB_PRESETS, type Queue, type QueueStats } from "@v1/queue";
import {
  type BulkSyncJobData,
  NPM_BULK_SYNC_QUEUE,
  NPM_SYNC_QUEUE,
  type SyncJobData,
} from "@v1/queue/npm-sync";

export { NPM_BULK_SYNC_QUEUE, NPM_SYNC_QUEUE, type BulkSyncJobData, type SyncJobData };

let syncQueue: Queue<SyncJobData> | null = null;
let bulkSyncQueue: Queue<BulkSyncJobData> | null = null;

export function getSyncQueue(): Queue<SyncJobData> {
  if (!syncQueue) {
    syncQueue = getQueue<SyncJobData>({
      name: NPM_SYNC_QUEUE,
      defaultJobOptions: JOB_PRESETS.standard,
    });
  }
  return syncQueue;
}

export function getBulkSyncQueue(): Queue<BulkSyncJobData> {
  if (!bulkSyncQueue) {
    bulkSyncQueue = getQueue<BulkSyncJobData>({
      name: NPM_BULK_SYNC_QUEUE,
      defaultJobOptions: JOB_PRESETS.bulk,
    });
  }
  return bulkSyncQueue;
}

export async function getCombinedStats(): Promise<{ sync: QueueStats; bulk: QueueStats }> {
  const [sync, bulk] = await Promise.all([
    getQueueStats(getSyncQueue()),
    getQueueStats(getBulkSyncQueue()),
  ]);
  return { sync, bulk };
}
