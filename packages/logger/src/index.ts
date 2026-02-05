/**
 * @packrun/logger
 *
 * Shared logging package using consola for beautiful colored output.
 */

import { type ConsolaOptions, createConsola } from "consola";
import { colorize, colors } from "consola/utils";

// Create base logger with fancy output
// Using type assertion to allow the `fancy` option which is valid at runtime
// but not fully typed in ConsolaOptions (it's a factory-specific option)
export const logger = createConsola({
  fancy: true,
  formatOptions: {
    date: false, // timestamps handled by deployment platform
    colors: true,
    compact: false,
  },
} as Partial<ConsolaOptions> & { fancy?: boolean });

// Create scoped loggers for different services
export const createLogger = (tag: string) => logger.withTag(tag);

// Pre-configured service loggers
export const api = createLogger("api");
export const worker = createLogger("worker");
export const db = createLogger("db");
export const mcp = createLogger("mcp");

// Re-export color utilities for styled output
export { colors, colorize };

// Re-export consola types
export type { ConsolaInstance } from "consola";
export type { ColorName } from "consola/utils";
