/**
 * oRPC Module
 *
 * Re-exports all oRPC utilities for convenient imports.
 */

export { type AppRouter, client } from "./client";
export { getQueryClient, HydrateClient } from "./hydration";
export { orpc } from "./query";
export { createQueryClient } from "./query-client";
