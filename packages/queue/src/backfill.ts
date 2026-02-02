/**
 * Backfill Queue Configuration
 *
 * Shared config for npm registry backfill jobs.
 */

export const NPM_BACKFILL_QUEUE = "npm-backfill";

export type BackfillStatus = "idle" | "running" | "paused" | "completed" | "error";

export interface BackfillState {
  status: BackfillStatus;
  offset: number;
  total: number;
  synced: number;
  failed: number;
  startedAt: number;
  updatedAt: number;
  rate: number;
  error?: string;
}

export interface BackfillJobData {
  action: "tick";
}

export const BACKFILL_REDIS_KEYS = {
  state: "backfill:state",
  packages: "backfill:packages",
} as const;

export const DEFAULT_BACKFILL_STATE: BackfillState = {
  status: "idle",
  offset: 0,
  total: 0,
  synced: 0,
  failed: 0,
  startedAt: 0,
  updatedAt: 0,
  rate: 0,
};
