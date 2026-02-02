/**
 * npm Sync Queue Configuration
 *
 * Shared config for npm package sync jobs used by both API and worker.
 */

export const NPM_SYNC_QUEUE = "npm-sync";
export const NPM_BULK_SYNC_QUEUE = "npm-bulk-sync";

export interface SyncJobData {
  name: string;
  deleted?: boolean;
  seq: string;
}

export interface BulkSyncJobData {
  names: string[];
  phase?: number;
}
