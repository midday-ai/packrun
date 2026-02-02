/**
 * npm Sync Job Types
 */

export interface SyncJobData {
  name: string;
  deleted?: boolean;
  seq: string;
}

export interface BulkSyncJobData {
  names: string[];
  phase?: number;
}
