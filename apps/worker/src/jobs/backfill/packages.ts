/**
 * Package List Fetching
 *
 * Fetches all package names from npm registry for backfill.
 * Uses the CouchDB _changes endpoint for reliable pagination.
 */

interface ChangesResponse {
  results: Array<{
    id: string;
    deleted?: boolean;
    seq: string;
  }>;
  last_seq: string;
}

const CHANGES_URL = "https://replicate.npmjs.com/registry/_changes";
const BATCH_SIZE = 10000;

/**
 * Fetch all package names from npm registry using the _changes endpoint.
 * This is more reliable than _all_docs for large datasets as it naturally paginates.
 */
export async function getAllPackages(onProgress?: (count: number) => void): Promise<string[]> {
  console.log("[Backfill] Fetching all package names from npm registry...");

  const packages = new Set<string>();
  let lastSeq = "0";
  let iteration = 0;

  while (true) {
    iteration++;
    const url = `${CHANGES_URL}?since=${lastSeq}&limit=${BATCH_SIZE}`;

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch changes: ${response.status}`);
    }

    const data = (await response.json()) as ChangesResponse;

    for (const row of data.results) {
      // Skip design docs and deleted packages
      if (!row.id.startsWith("_design/") && !row.deleted) {
        packages.add(row.id);
      }
    }

    // Log progress
    if (iteration % 10 === 0 || data.results.length < BATCH_SIZE) {
      console.log(
        `[Backfill] Fetched ${packages.size.toLocaleString()} unique packages (seq: ${lastSeq})`,
      );
    }

    onProgress?.(packages.size);

    // Check if we've reached the end
    if (data.results.length < BATCH_SIZE) {
      break;
    }

    lastSeq = data.last_seq;
  }

  console.log(`[Backfill] Total: ${packages.size.toLocaleString()} packages`);

  return Array.from(packages);
}
