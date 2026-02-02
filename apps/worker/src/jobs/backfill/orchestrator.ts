/**
 * Backfill Orchestrator
 *
 * Manages the backfill process by queuing batches of packages
 * and tracking progress. Runs as a repeatable BullMQ job.
 */

import { createWorker, getQueue, JOB_PRESETS, type Job } from "@v1/queue";
import { type BackfillJobData, NPM_BACKFILL_QUEUE } from "@v1/queue/backfill";
import { queueBulkSync } from "../npm-sync/producer";
import { getAllPackages } from "./packages";
import {
  completeBackfill,
  errorBackfill,
  getBackfillState,
  getPackageBatch,
  pauseBackfill,
  resetBackfill,
  resumeBackfill,
  startBackfill,
  updateProgress,
} from "./state";

// Batch size for each tick (packages to queue per orchestrator run)
const BATCH_SIZE = 500;

// How often the orchestrator runs (in milliseconds)
const TICK_INTERVAL = 5000;

let backfillQueue: ReturnType<typeof getQueue<BackfillJobData>> | null = null;

/**
 * Get the backfill queue instance
 */
export function getBackfillQueue() {
  if (!backfillQueue) {
    backfillQueue = getQueue<BackfillJobData>({
      name: NPM_BACKFILL_QUEUE,
      defaultJobOptions: {
        ...JOB_PRESETS.standard,
        removeOnComplete: { count: 10 },
        removeOnFail: { count: 100 },
      },
    });
  }
  return backfillQueue;
}

/**
 * Process a single orchestrator tick
 */
async function processBackfillTick(job: Job<BackfillJobData>): Promise<void> {
  const state = await getBackfillState();

  // Only process if running
  if (state.status !== "running") {
    return;
  }

  // If total is 0, we need to initialize the package list (API started the backfill)
  if (state.total === 0) {
    console.log("[Backfill] Initializing full registry sync...");

    try {
      const packages = await getAllPackages((count) => {
        console.log(`[Backfill] Fetched ${count.toLocaleString()} packages`);
      });

      await startBackfill(packages);
      console.log(`[Backfill] Initialized: ${packages.length.toLocaleString()} packages to sync`);
    } catch (error) {
      console.error("[Backfill] Failed to initialize:", error);
      await errorBackfill(error instanceof Error ? error.message : "Unknown error");
      return;
    }

    // Re-fetch state after initialization
    const newState = await getBackfillState();
    if (newState.total === 0) {
      console.error("[Backfill] No packages to sync");
      await completeBackfill();
      return;
    }
  }

  // Re-fetch state (in case it was just initialized)
  const currentState = await getBackfillState();

  // Check if we've finished
  if (currentState.offset >= currentState.total) {
    console.log("[Backfill] Completed! All packages processed.");
    await completeBackfill();
    return;
  }

  // Get next batch of packages
  const packages = await getPackageBatch(currentState.offset, BATCH_SIZE);

  if (packages.length === 0) {
    console.log("[Backfill] No more packages to process.");
    await completeBackfill();
    return;
  }

  // Queue the batch for processing
  await queueBulkSync(packages);

  // Update progress
  const newOffset = currentState.offset + packages.length;
  await updateProgress(packages.length, 0, newOffset);

  // Calculate progress
  const progress = ((newOffset / currentState.total) * 100).toFixed(2);
  const elapsed = (Date.now() - currentState.startedAt) / 1000;
  const rate = newOffset / elapsed;
  const remaining = currentState.total - newOffset;
  const eta = remaining / rate;

  console.log(
    `[Backfill] Progress: ${newOffset.toLocaleString()}/${currentState.total.toLocaleString()} (${progress}%) | ` +
      `Rate: ${rate.toFixed(1)}/s | ETA: ${formatDuration(eta)}`,
  );
}

/**
 * Create the backfill worker
 */
export function createBackfillWorker() {
  const worker = createWorker<BackfillJobData>(NPM_BACKFILL_QUEUE, processBackfillTick, {
    concurrency: 1, // Only one tick at a time
  });

  worker.on("completed", () => {
    // Schedule next tick if still running
    scheduleNextTick();
  });

  worker.on("failed", (job, error) => {
    console.error("[Backfill] Tick failed:", error.message);
    // Still schedule next tick on failure
    scheduleNextTick();
  });

  worker.on("error", (error) => {
    console.error("[Backfill] Worker error:", error);
  });

  return worker;
}

/**
 * Schedule the next orchestrator tick
 */
async function scheduleNextTick(): Promise<void> {
  const state = await getBackfillState();
  if (state.status !== "running") {
    return;
  }

  const queue = getBackfillQueue();
  await queue.add(
    "tick",
    { action: "tick" },
    {
      delay: TICK_INTERVAL,
      jobId: `backfill-tick-${Date.now()}`,
    },
  );
}

/**
 * Start a new backfill of the full npm registry
 */
export async function startBackfillProcess(): Promise<void> {
  const currentState = await getBackfillState();

  if (currentState.status === "running") {
    throw new Error("Backfill already running. Pause it first to start a new one.");
  }

  console.log("[Backfill] Starting full registry sync...");

  // Fetch all packages
  const packages = await getAllPackages((count) => {
    console.log(`[Backfill] Fetched ${count.toLocaleString()} packages`);
  });

  // Initialize state
  await startBackfill(packages);

  console.log(`[Backfill] Initialized: ${packages.length.toLocaleString()} packages to sync`);

  // Schedule first tick immediately
  const queue = getBackfillQueue();
  await queue.add(
    "tick",
    { action: "tick" },
    {
      jobId: `backfill-tick-${Date.now()}`,
    },
  );

  console.log("[Backfill] Started! First tick scheduled.");
}

/**
 * Pause the backfill
 */
export async function pauseBackfillProcess(): Promise<void> {
  await pauseBackfill();
  console.log("[Backfill] Paused.");
}

/**
 * Resume the backfill
 */
export async function resumeBackfillProcess(): Promise<void> {
  await resumeBackfill();

  // Schedule next tick
  const queue = getBackfillQueue();
  await queue.add(
    "tick",
    { action: "tick" },
    {
      jobId: `backfill-tick-${Date.now()}`,
    },
  );

  console.log("[Backfill] Resumed.");
}

/**
 * Reset the backfill
 */
export async function resetBackfillProcess(): Promise<void> {
  await resetBackfill();

  // Clear any pending jobs
  const queue = getBackfillQueue();
  await queue.drain();

  console.log("[Backfill] Reset to idle.");
}

/**
 * Get backfill status with formatted info
 */
export async function getBackfillStatus() {
  const state = await getBackfillState();

  const progress = state.total > 0 ? ((state.offset / state.total) * 100).toFixed(2) : "0";

  const elapsed = state.startedAt ? (Date.now() - state.startedAt) / 1000 : 0;
  const eta = state.rate > 0 ? (state.total - state.offset) / state.rate : 0;

  return {
    ...state,
    progress: `${progress}%`,
    elapsed: formatDuration(elapsed),
    eta: formatDuration(eta),
    remaining: state.total - state.offset,
  };
}

/**
 * Format duration in human-readable format
 */
function formatDuration(seconds: number): string {
  if (!seconds || seconds < 0) return "N/A";
  if (seconds < 60) return `${seconds.toFixed(0)}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${Math.floor(seconds % 60)}s`;
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
}
