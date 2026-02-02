/**
 * Queue Client for API
 *
 * Adds jobs to the worker's sync queue with deduplication.
 */

import { closeAllQueues, getQueue, JOB_PRESETS, type Queue } from "@v1/queue";
import { NPM_SYNC_QUEUE, type SyncJobData } from "@v1/queue/npm-sync";
import { cache } from "./redis";

let syncQueue: Queue<SyncJobData> | null = null;

function getSyncQueue(): Queue<SyncJobData> {
  if (!syncQueue) {
    syncQueue = getQueue<SyncJobData>({
      name: NPM_SYNC_QUEUE,
      defaultJobOptions: JOB_PRESETS.standard,
    });
  }
  return syncQueue;
}

// Deduplication - don't re-queue within 5 minutes
const QUEUED_KEY = (name: string) => `queued:${name}`;
const QUEUED_TTL = 60 * 5;

/**
 * Queue a package for syncing. Returns true if queued, false if deduplicated.
 */
export async function queuePackageSync(name: string): Promise<boolean> {
  const recentlyQueued = await cache.get<boolean>(QUEUED_KEY(name));
  if (recentlyQueued) return false;

  try {
    const queue = getSyncQueue();
    await queue.add(
      "sync",
      { name, deleted: false, seq: `api-${Date.now()}` },
      { jobId: `api-sync-${name}-${Date.now()}`, priority: 1 },
    );
    await cache.set(QUEUED_KEY(name), true, QUEUED_TTL);
    console.log(`[Queue] Queued: ${name}`);
    return true;
  } catch (error) {
    console.error(`[Queue] Failed to queue ${name}:`, error);
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
