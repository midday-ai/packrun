/**
 * Backfill Control
 *
 * API-side control for the backfill process. State is stored in Redis
 * and processed by the worker.
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
async function setBackfillState(updates: Partial<BackfillState>): Promise<BackfillState> {
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
 * Request a backfill start (worker will pick this up)
 * Sets status to "running" - worker will fetch all packages and begin syncing
 */
export async function requestBackfillStart(): Promise<BackfillState> {
  const current = await getBackfillState();

  if (current.status === "running") {
    throw new Error("Backfill already running. Pause it first to start a new one.");
  }

  // Set to running - the worker will see this and start the backfill
  return setBackfillState({
    status: "running",
    offset: 0,
    total: 0, // Will be set by worker when it fetches packages
    synced: 0,
    failed: 0,
    startedAt: Date.now(),
    rate: 0,
    error: undefined,
  });
}

/**
 * Pause the backfill
 */
export async function pauseBackfill(): Promise<BackfillState> {
  const state = await getBackfillState();
  if (state.status !== "running") {
    throw new Error(`Cannot pause: current status is "${state.status}"`);
  }
  return setBackfillState({ status: "paused" });
}

/**
 * Resume the backfill
 */
export async function resumeBackfill(): Promise<BackfillState> {
  const state = await getBackfillState();
  if (state.status !== "paused") {
    throw new Error(`Cannot resume: current status is "${state.status}"`);
  }
  return setBackfillState({ status: "running" });
}

/**
 * Reset backfill state
 */
export async function resetBackfill(): Promise<BackfillState> {
  await getRedis().del(BACKFILL_REDIS_KEYS.packages);
  return setBackfillState({ ...DEFAULT_BACKFILL_STATE });
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
