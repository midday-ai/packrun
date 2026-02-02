/**
 * npm Changes Listener
 *
 * Streams changes from the npm registry's CouchDB replication feed.
 */

import { config } from "../config";

export interface NpmChange {
  seq: string;
  id: string;
  deleted?: boolean;
}

/**
 * Stream changes from npm registry
 */
export async function* streamChanges(since = "now"): AsyncGenerator<NpmChange> {
  const url = `${config.npm.replicateUrl}/_changes?since=${since}&feed=continuous&include_docs=false&heartbeat=30000`;

  const response = await fetch(url);
  if (!response.ok || !response.body) {
    throw new Error(`Failed to connect to changes feed: ${response.status}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (!line.trim()) continue;

      try {
        const change = JSON.parse(line);
        if (change.id && change.seq) {
          yield {
            seq: change.seq,
            id: change.id,
            deleted: change.deleted,
          };
        }
      } catch {
        // Heartbeat or invalid JSON, skip
      }
    }
  }
}
