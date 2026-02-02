/**
 * Backfill State Management
 *
 * Persists backfill progress to Redis for crash recovery and monitoring.
 */

import {
  BACKFILL_REDIS_KEYS,
  type BackfillState,
  DEFAULT_BACKFILL_STATE,
} from "@v1/queue/backfill";
import Redis from "ioredis";

let redis: Redis | null = null;

function getRedis(): Redis {
  if (!redis) {
    redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379");
  }
  return redis;
}

/**
 * Get current backfill state from Redis
 */
export async function getBackfillState(): Promise<BackfillState> {
  const data = await getRedis().get(BACKFILL_REDIS_KEYS.state);
  if (!data) {
    return { ...DEFAULT_BACKFILL_STATE };
  }
  return JSON.parse(data) as BackfillState;
}

/**
 * Update backfill state in Redis
 */
export async function setBackfillState(updates: Partial<BackfillState>): Promise<BackfillState> {
  const current = await getBackfillState();
  const newState: BackfillState = {
    ...current,
    ...updates,
    updatedAt: Date.now(),
  };
  await getRedis().set(BACKFILL_REDIS_KEYS.state, JSON.stringify(newState));
  return newState;
}

/**
 * Start a new backfill
 */
export async function startBackfill(packages: string[]): Promise<BackfillState> {
  // Store package list
  await setPackageList(packages);

  // Initialize state
  return setBackfillState({
    status: "running",
    offset: 0,
    total: packages.length,
    synced: 0,
    failed: 0,
    startedAt: Date.now(),
    rate: 0,
    error: undefined,
  });
}

/**
 * Resume a paused backfill
 */
export async function resumeBackfill(): Promise<BackfillState> {
  const state = await getBackfillState();
  if (state.status !== "paused") {
    throw new Error(`Cannot resume: current status is "${state.status}"`);
  }
  return setBackfillState({ status: "running" });
}

/**
 * Pause a running backfill
 */
export async function pauseBackfill(): Promise<BackfillState> {
  const state = await getBackfillState();
  if (state.status !== "running") {
    throw new Error(`Cannot pause: current status is "${state.status}"`);
  }
  return setBackfillState({ status: "paused" });
}

/**
 * Mark backfill as completed
 */
export async function completeBackfill(): Promise<BackfillState> {
  return setBackfillState({ status: "completed" });
}

/**
 * Mark backfill as errored
 */
export async function errorBackfill(error: string): Promise<BackfillState> {
  return setBackfillState({ status: "error", error });
}

/**
 * Reset backfill state to idle
 */
export async function resetBackfill(): Promise<BackfillState> {
  await getRedis().del(BACKFILL_REDIS_KEYS.packages);
  return setBackfillState({ ...DEFAULT_BACKFILL_STATE });
}

/**
 * Update progress metrics
 */
export async function updateProgress(
  synced: number,
  failed: number,
  newOffset: number,
): Promise<BackfillState> {
  const state = await getBackfillState();
  const elapsed = (Date.now() - state.startedAt) / 1000;
  const totalProcessed = state.synced + synced;
  const rate = elapsed > 0 ? totalProcessed / elapsed : 0;

  return setBackfillState({
    offset: newOffset,
    synced: state.synced + synced,
    failed: state.failed + failed,
    rate: Math.round(rate * 100) / 100,
  });
}

/**
 * Store the full package list
 */
export async function setPackageList(packages: string[]): Promise<void> {
  // Store as JSON array
  await getRedis().set(BACKFILL_REDIS_KEYS.packages, JSON.stringify(packages));
}

/**
 * Get packages for the next batch
 */
export async function getPackageBatch(offset: number, batchSize: number): Promise<string[]> {
  const data = await getRedis().get(BACKFILL_REDIS_KEYS.packages);
  if (!data) {
    return [];
  }
  const packages = JSON.parse(data) as string[];
  return packages.slice(offset, offset + batchSize);
}

/**
 * Get total package count
 */
export async function getPackageCount(): Promise<number> {
  const data = await getRedis().get(BACKFILL_REDIS_KEYS.packages);
  if (!data) {
    return 0;
  }
  const packages = JSON.parse(data) as string[];
  return packages.length;
}

/**
 * Close Redis connection
 */
export async function closeRedis(): Promise<void> {
  if (redis) {
    await redis.quit();
    redis = null;
  }
}
