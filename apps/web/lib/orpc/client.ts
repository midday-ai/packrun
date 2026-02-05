/**
 * oRPC Client
 *
 * Type-safe client for calling API procedures.
 */

import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import type { RouterClient } from "@orpc/server";
import type { AppRouter } from "@packrun/api-server/procedures";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

if (!API_URL) {
  console.warn("[orpc] NEXT_PUBLIC_API_URL not configured");
}

const link = new RPCLink({
  url: `${API_URL || "http://localhost:3001"}/rpc`,
  // Include credentials for authenticated requests
  fetch: (input, init) =>
    fetch(input, {
      ...init,
      credentials: "include",
    }),
});

export const client: RouterClient<AppRouter> = createORPCClient(link);

// Re-export the router type for convenience
export type { AppRouter };
