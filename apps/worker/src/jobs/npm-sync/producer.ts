/**
 * npm Sync Producer
 *
 * Functions to add jobs to the npm sync queues.
 */

import { getBulkSyncQueue, getSyncQueue } from "./queue";

/**
 * Add a package to the sync queue
 */
export async function queuePackageSync(name: string, seq: string, deleted = false): Promise<void> {
  const queue = getSyncQueue();
  await queue.add(
    "sync-package",
    { name, seq, deleted },
    {
      jobId: `sync:${name}:${seq}`, // Dedupe by package+seq
    },
  );
}

/**
 * Add multiple packages to the bulk sync queue
 */
export async function queueBulkSync(names: string[], phase?: number): Promise<void> {
  const queue = getBulkSyncQueue();
  // Split into chunks of 50 for manageable job sizes
  const chunkSize = 50;
  for (let i = 0; i < names.length; i += chunkSize) {
    const chunk = names.slice(i, i + chunkSize);
    await queue.add(
      "bulk-sync",
      { names: chunk, phase },
      {
        jobId: `bulk:${phase || 0}:${i}`,
      },
    );
  }
}
