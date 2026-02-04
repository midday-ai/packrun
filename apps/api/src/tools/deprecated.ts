/**
 * check_deprecated - Check if a package is deprecated and get alternatives
 *
 * Optimized: Uses Typesense + module-replacements for instant lookups
 */

import { getAlternatives, PACKAGE_ALTERNATIVES } from "@v1/decisions/comparisons";
import { z } from "zod";
import {
  getDeprecationMessage,
  getLatestVersion,
  getPackage,
  isDeprecated,
} from "../lib/clients/npm";
import { getPackage as getTypesensePackage } from "../lib/clients/typesense";
import { formatReplacement } from "../lib/replacements";

export const checkDeprecatedSchema = z.object({
  name: z.string().describe("The npm package name to check"),
});

export type CheckDeprecatedInput = z.infer<typeof checkDeprecatedSchema>;

export interface CheckDeprecatedResult {
  name: string;
  version: string;
  deprecated: boolean;
  deprecationMessage: string | null;
  maintenanceMode: boolean;
  alternatives: string[] | null;
  recommended: string | null;
  reason: string | null;
  hasNativeReplacement?: boolean;
  nativeReplacementInfo?: string;
}

export async function checkDeprecated(input: CheckDeprecatedInput): Promise<CheckDeprecatedResult> {
  // Try Typesense first for deprecation status
  // Verify exact name match to avoid tokenization issues (e.g., "react" vs "re-act")
  const typesensePkg = await getTypesensePackage(input.name);

  if (typesensePkg && typesensePkg.name === input.name) {
    // Check module-replacements for native alternatives (instant O(1))
    const replacement = formatReplacement(input.name);

    // Check if we have curated alternatives
    const alternativeInfo = getAlternatives(input.name);
    const inMaintenanceList = input.name in PACKAGE_ALTERNATIVES;

    return {
      name: typesensePkg.name,
      version: typesensePkg.version,
      deprecated: typesensePkg.deprecated || false,
      deprecationMessage: typesensePkg.deprecatedMessage || null,
      maintenanceMode: inMaintenanceList && !typesensePkg.deprecated,
      alternatives: alternativeInfo?.alternatives || null,
      recommended: replacement?.replacement || alternativeInfo?.recommended || null,
      reason: replacement?.reason || alternativeInfo?.reason || null,
      hasNativeReplacement: replacement?.type === "native",
      nativeReplacementInfo: replacement?.type === "native" ? replacement.reason : undefined,
    };
  }

  // Fall back to npm registry
  const pkg = await getPackage(input.name);

  if (!pkg) {
    throw new Error(`Package '${input.name}' not found`);
  }

  const version = getLatestVersion(pkg);
  const deprecated = isDeprecated(pkg);
  const deprecationMessage = getDeprecationMessage(pkg);

  // Check module-replacements for native alternatives
  const replacement = formatReplacement(input.name);

  // Check if we have curated alternatives
  const alternativeInfo = getAlternatives(input.name);
  const inMaintenanceList = input.name in PACKAGE_ALTERNATIVES;

  return {
    name: pkg.name,
    version,
    deprecated,
    deprecationMessage,
    maintenanceMode: inMaintenanceList && !deprecated,
    alternatives: alternativeInfo?.alternatives || null,
    recommended: replacement?.replacement || alternativeInfo?.recommended || null,
    reason: replacement?.reason || alternativeInfo?.reason || null,
    hasNativeReplacement: replacement?.type === "native",
    nativeReplacementInfo: replacement?.type === "native" ? replacement.reason : undefined,
  };
}
