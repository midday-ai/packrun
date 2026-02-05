/**
 * Module Replacements Library
 *
 * Loads module-replacements into memory for instant O(1) lookups.
 * Contains curated replacement mappings from the community.
 */

import { api as log } from "@packrun/logger";
import { all, type ModuleReplacement, nativeReplacements } from "module-replacements";

// In-memory maps for O(1) lookup
const moduleToReplacement = new Map<string, ModuleReplacement>();
const nativeModules = new Set<string>();

// Initialize on module load
let initialized = false;

/**
 * Initialize the replacement maps
 */
export function initReplacements(): void {
  if (initialized) return;

  // Load all module replacements
  for (const rep of all.moduleReplacements) {
    moduleToReplacement.set(rep.moduleName, rep);
  }

  // Load native modules
  for (const rep of nativeReplacements.moduleReplacements) {
    nativeModules.add(rep.moduleName);
  }

  initialized = true;
  log.success(`Loaded ${moduleToReplacement.size} modules, ${nativeModules.size} native`);
}

/**
 * Get replacement for a package (instant O(1) lookup)
 */
export function getReplacement(packageName: string): ModuleReplacement | null {
  if (!initialized) initReplacements();
  return moduleToReplacement.get(packageName) || null;
}

/**
 * Check if a package has a native replacement
 */
export function hasNativeReplacement(packageName: string): boolean {
  if (!initialized) initReplacements();
  return nativeModules.has(packageName);
}

/**
 * Format replacement info for API response
 */
export interface ReplacementInfo {
  type: "native" | "documented" | "simple" | "none";
  replacement?: string;
  reason?: string;
  url?: string;
}

export function formatReplacement(packageName: string): ReplacementInfo | null {
  if (!initialized) initReplacements();

  const rep = moduleToReplacement.get(packageName);
  if (!rep) return null;

  const isNative = nativeModules.has(packageName);

  switch (rep.type) {
    case "native":
      return {
        type: "native",
        replacement: rep.replacement,
        reason: `Use native JavaScript (Node ${rep.nodeVersion}+)`,
        url: `https://developer.mozilla.org${rep.mdnPath}`,
      };
    case "documented":
      return {
        type: "documented",
        reason: "See documentation for alternatives",
        url: `https://github.com/AikidoSec/module-replacements/blob/main/docs/${rep.docPath}`,
      };
    case "simple":
      return {
        type: "simple",
        replacement: rep.replacement,
        reason: isNative
          ? "Can be replaced with native JavaScript"
          : "Consider using a lighter alternative",
      };
    case "none":
      return {
        type: "none",
        reason: "This module may not be needed",
      };
    default:
      return null;
  }
}

/**
 * Get all replacement stats
 */
export function getReplacementStats(): {
  totalModules: number;
  nativeModules: number;
} {
  if (!initialized) initReplacements();
  return {
    totalModules: moduleToReplacement.size,
    nativeModules: nativeModules.size,
  };
}
