/**
 * Queue Client for API
 *
 * Adds jobs to the worker's sync queue with BullMQ deduplication via job IDs.
 */

import { api as log } from "@packrun/logger";
import {
  closeAllQueues,
  getConnectionInfo,
  getQueue,
  JOB_PRESETS,
  type Queue,
} from "@packrun/queue";
import { NPM_SYNC_QUEUE, type SyncJobData } from "@packrun/queue/npm-sync";

let syncQueue: Queue<SyncJobData> | null = null;
let logged = false;

function getSyncQueue(): Queue<SyncJobData> {
  if (!syncQueue) {
    syncQueue = getQueue<SyncJobData>({
      name: NPM_SYNC_QUEUE,
      defaultJobOptions: JOB_PRESETS.standard,
    });
    if (!logged) {
      const info = getConnectionInfo();
      log.ready(`Queue connected to ${info.host}:${info.port}`);
      logged = true;
    }
  }
  return syncQueue;
}

/**
 * Queue a package for syncing.
 * Uses BullMQ's built-in deduplication via stable job IDs.
 * Returns true if queued, false if duplicate (already in queue).
 */
export async function queuePackageSync(name: string): Promise<boolean> {
  try {
    const queue = getSyncQueue();
    const jobId = `api-sync-${name}`;

    // Check if job already exists (waiting, active, or delayed)
    const existingJob = await queue.getJob(jobId);
    if (existingJob && !existingJob.finishedOn) {
      // Job exists and hasn't finished yet - deduplicated
      return false;
    }

    // Add job with stable ID - BullMQ will prevent duplicates automatically
    await queue.add(
      "sync",
      { name, deleted: false, seq: `api-${Date.now()}` },
      { jobId, priority: 1 },
    );
    log.info(`Queued: ${name}`);
    return true;
  } catch (error) {
    log.error(`Failed to queue ${name}:`, error);
    return false;
  }
}

/**
 * Queue multiple packages for syncing.
 */
export async function queuePackagesSyncBatch(names: string[]): Promise<number> {
  let queued = 0;
  for (const name of names) {
    if (await queuePackageSync(name)) queued++;
  }
  return queued;
}

export async function closeQueues(): Promise<void> {
  await closeAllQueues();
  syncQueue = null;
}
