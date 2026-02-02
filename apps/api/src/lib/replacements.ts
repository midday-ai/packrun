/**
 * Module Replacements Library
 *
 * Loads module-replacements into memory for instant O(1) lookups.
 * Contains curated replacement mappings from the community.
 */

import { all, type ManifestReplacement, nativeReplacements } from "module-replacements";

// In-memory maps for O(1) lookup
const moduleToReplacements = new Map<string, string[]>();
const replacementDetails = new Map<string, ManifestReplacement>();
const nativeModules = new Set<string>();

// Initialize on module load
let initialized = false;

/**
 * Initialize the replacement maps
 */
export function initReplacements(): void {
  if (initialized) return;

  // Load all modules
  for (const mod of all.modules) {
    moduleToReplacements.set(mod.id, mod.replacements);
  }

  // Load all replacement details
  for (const rep of all.replacements) {
    replacementDetails.set(rep.id, rep);
  }

  // Load native modules
  for (const mod of nativeReplacements.modules) {
    nativeModules.add(mod.id);
  }

  initialized = true;
  console.log(
    `[Replacements] Loaded ${moduleToReplacements.size} modules, ` +
      `${replacementDetails.size} replacements, ${nativeModules.size} native`,
  );
}

/**
 * Get replacement IDs for a package (instant O(1) lookup)
 */
export function getReplacementIds(packageName: string): string[] | null {
  if (!initialized) initReplacements();
  return moduleToReplacements.get(packageName) || null;
}

/**
 * Check if a package has a native replacement
 */
export function hasNativeReplacement(packageName: string): boolean {
  if (!initialized) initReplacements();
  return nativeModules.has(packageName);
}

/**
 * Get replacement details by ID
 */
export function getReplacementDetails(id: string): ManifestReplacement | null {
  if (!initialized) initReplacements();
  return replacementDetails.get(id) || null;
}

/**
 * Format replacement info for API response
 */
export interface ReplacementInfo {
  type: "native" | "optimisation" | "none";
  useInstead?: string;
  alternatives?: string[];
  reason?: string;
  url?: string;
  example?: string;
}

export function formatReplacement(packageName: string): ReplacementInfo | null {
  if (!initialized) initReplacements();

  const replacementIds = moduleToReplacements.get(packageName);
  if (!replacementIds || replacementIds.length === 0) return null;

  const isNative = nativeModules.has(packageName);
  const firstReplacement = replacementDetails.get(replacementIds[0] || "");

  if (!firstReplacement) {
    return {
      type: isNative ? "native" : "optimisation",
      alternatives: replacementIds,
      reason: isNative
        ? "Can be replaced with native JavaScript"
        : "Consider using a lighter alternative",
    };
  }

  return {
    type: isNative ? "native" : "optimisation",
    useInstead: firstReplacement.id,
    alternatives: replacementIds.length > 1 ? replacementIds : undefined,
    reason: isNative
      ? "Can be replaced with native JavaScript"
      : "Consider using a lighter/better maintained alternative",
    url: firstReplacement.url,
    example: firstReplacement.example,
  };
}

/**
 * Get all replacement stats
 */
export function getReplacementStats(): {
  totalModules: number;
  totalReplacements: number;
  nativeModules: number;
} {
  if (!initialized) initReplacements();
  return {
    totalModules: moduleToReplacements.size,
    totalReplacements: replacementDetails.size,
    nativeModules: nativeModules.size,
  };
}
