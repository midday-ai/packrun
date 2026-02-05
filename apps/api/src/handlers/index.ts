/**
 * Handlers Index
 *
 * Re-exports all standalone request handlers.
 * These are used for routes that don't fit the oRPC model
 * (SSE streaming, HTML pages, special transports).
 */

export { handleMcp } from "./mcp";
export { handleUnsubscribe } from "./unsubscribe";
export { handleUpdatesStream } from "./updates";
