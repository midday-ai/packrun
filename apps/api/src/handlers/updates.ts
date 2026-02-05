/**
 * Updates Handler
 *
 * SSE endpoint for streaming live npm registry changes.
 * This is a standalone handler (not oRPC) because SSE has specific requirements.
 */

interface NpmChange {
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

const NPM_REPLICATE_URL = "https://replicate.npmjs.com/registry";

async function fetchNpmChanges(
  since: string,
  limit = 100,
): Promise<{ changes: NpmChange[]; lastSeq: string }> {
  const url = `${NPM_REPLICATE_URL}/_changes?since=${since}&limit=${limit}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch changes: HTTP ${response.status}`);
  }

  const data = (await response.json()) as ChangesResponse;

  const changes: NpmChange[] = data.results
    .filter((result) => !result.id.startsWith("_design/"))
    .map((result) => ({
      seq: String(result.seq),
      id: result.id,
      deleted: result.deleted,
    }));

  return {
    changes,
    lastSeq: String(data.last_seq),
  };
}

async function getCurrentNpmSeq(): Promise<string> {
  const response = await fetch(`${NPM_REPLICATE_URL}/`);
  if (!response.ok) {
    throw new Error(`Failed to get registry info: ${response.status}`);
  }
  const data = (await response.json()) as { update_seq: string | number };
  return String(data.update_seq);
}

/**
 * Handle updates stream request
 */
export async function handleUpdatesStream(request: Request): Promise<Response> {
  const encoder = new TextEncoder();

  // Get initial sequence
  let currentSeq: string;
  try {
    currentSeq = await getCurrentNpmSeq();
  } catch {
    return new Response(JSON.stringify({ error: "Failed to connect to npm registry" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const stream = new ReadableStream({
    start(controller) {
      let isRunning = true;

      // Send initial connection event
      controller.enqueue(
        encoder.encode(`event: connected\ndata: ${JSON.stringify({ seq: currentSeq })}\n\n`),
      );

      // Polling function
      const poll = async () => {
        while (isRunning) {
          try {
            const { changes, lastSeq } = await fetchNpmChanges(currentSeq, 25);

            for (const change of changes) {
              if (!isRunning) break;
              if (change.deleted) continue;

              const eventData = {
                name: change.id,
                seq: change.seq,
                timestamp: Date.now(),
              };

              controller.enqueue(
                encoder.encode(`event: package\ndata: ${JSON.stringify(eventData)}\n\n`),
              );
            }

            currentSeq = lastSeq;
            await new Promise((resolve) => setTimeout(resolve, 2000));
          } catch {
            controller.enqueue(
              encoder.encode(
                `event: error\ndata: ${JSON.stringify({ message: "Poll error" })}\n\n`,
              ),
            );
            await new Promise((resolve) => setTimeout(resolve, 5000));
          }
        }
      };

      // Keepalive ping
      const pingInterval = setInterval(() => {
        if (isRunning) {
          try {
            controller.enqueue(encoder.encode(`: ping\n\n`));
          } catch {
            isRunning = false;
            clearInterval(pingInterval);
          }
        }
      }, 15000);

      // Start polling in background
      poll().catch(() => {
        isRunning = false;
        clearInterval(pingInterval);
      });

      // Handle client disconnect
      request.signal?.addEventListener("abort", () => {
        isRunning = false;
        clearInterval(pingInterval);
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-store, no-transform, must-revalidate",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
      "CF-Cache-Status": "DYNAMIC",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Cache-Control",
      "Transfer-Encoding": "chunked",
    },
  });
}
