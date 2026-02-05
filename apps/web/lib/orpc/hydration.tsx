/**
 * Hydration Utilities
 *
 * Provides server-side query client caching and client-side hydration
 * for seamless SSR with oRPC and TanStack Query.
 */

import { dehydrate, HydrationBoundary, type QueryClient } from "@tanstack/react-query";
import { cache } from "react";
import { createQueryClient } from "./query-client";

/**
 * Get a cached QueryClient for the current request.
 * Uses React's cache() to ensure the same client is used across
 * all server components in a single request.
 */
export const getQueryClient = cache(createQueryClient);

/**
 * HydrateClient component for passing server-prefetched data to the client.
 * Wrap your client components with this after prefetching queries.
 */
export function HydrateClient({
  children,
  client,
}: {
  children: React.ReactNode;
  client: QueryClient;
}) {
  return <HydrationBoundary state={dehydrate(client)}>{children}</HydrationBoundary>;
}
