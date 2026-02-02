/**
 * npm Changes Listener
 *
 * Polls changes from the npm registry replication API.
 *
 * Note: As of 2025, npm deprecated continuous streaming feeds.
 * We now use manual pagination via the `since` parameter.
 * See: https://github.com/orgs/community/discussions/152515
 */

import { config } from "../config";

export interface NpmChange {
  seq: string;
  id: string;
  deleted?: boolean;
}

interface ChangesResponse {
  results: Array<{
    seq: number | string;
    id: string;
    deleted?: boolean;
    changes: Array<{ rev: string }>;
  }>;
  last_seq: number | string;
}

/**
 * Get the current update sequence from npm registry
 */
export async function getCurrentSeq(): Promise<string> {
  // Use the /registry/ endpoint for the new API
  const response = await fetch(`${config.npm.replicateUrl}/`);
  if (!response.ok) {
    throw new Error(`Failed to get registry info: ${response.status}`);
  }
  const data = (await response.json()) as { update_seq: string | number };
  return String(data.update_seq);
}

/**
 * Fetch a batch of changes from npm registry
 */
export async function fetchChanges(
  since: string,
  limit = 1000,
): Promise<{
  changes: NpmChange[];
  lastSeq: string;
}> {
  const url = `${config.npm.replicateUrl}/_changes?since=${since}&limit=${limit}`;

  const response = await fetch(url);

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Failed to fetch changes: HTTP ${response.status} - ${text.slice(0, 200)}`);
  }

  const data = (await response.json()) as ChangesResponse;

  const changes: NpmChange[] = data.results.map((result) => ({
    seq: String(result.seq),
    id: result.id,
    deleted: result.deleted,
  }));

  return {
    changes,
    lastSeq: String(data.last_seq),
  };
}

/**
 * Poll for changes continuously
 *
 * @param since - Starting sequence number
 * @param onChanges - Callback for each batch of changes
 * @param pollInterval - How often to poll when caught up (ms)
 */
export async function pollChanges(
  since: string,
  onChanges: (changes: NpmChange[]) => Promise<void>,
  pollInterval = 5000,
): Promise<never> {
  let currentSeq = since;
  let consecutiveEmpty = 0;

  while (true) {
    try {
      const { changes, lastSeq } = await fetchChanges(currentSeq);

      if (changes.length > 0) {
        await onChanges(changes);
        currentSeq = lastSeq;
        consecutiveEmpty = 0;

        // If we got a full batch, immediately fetch more
        if (changes.length >= 1000) {
          continue;
        }
      } else {
        consecutiveEmpty++;
      }

      // Wait before polling again (with exponential backoff when idle)
      const waitTime = Math.min(pollInterval * Math.pow(1.5, consecutiveEmpty), 30000);
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    } catch (error) {
      console.error("Error polling changes:", error);
      // Wait before retrying on error
      await new Promise((resolve) => setTimeout(resolve, pollInterval * 2));
    }
  }
}
