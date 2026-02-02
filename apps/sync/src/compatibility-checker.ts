/**
 * Compatibility checking for npm packages
 * Extracts Node version requirements, ESM/CJS compatibility
 */

interface PackageVersion {
  engines?: { node?: string; npm?: string };
  type?: string;
  main?: string;
  module?: string;
  exports?: unknown;
  types?: string;
  typings?: string;
}

export interface CompatibilityInfo {
  nodeVersion?: string;
  isESM: boolean;
  isCJS: boolean;
  hasTypes: boolean;
}

export function extractCompatibility(
  versionData: PackageVersion,
  packageName: string,
): CompatibilityInfo {
  const nodeVersion = versionData.engines?.node || undefined;

  const hasTypes = Boolean(
    versionData.types || versionData.typings || packageName.startsWith("@types/"),
  );

  const isESM = Boolean(
    versionData.type === "module" ||
      versionData.module ||
      (versionData.exports && typeof versionData.exports === "object"),
  );

  const isCJS = Boolean(versionData.type !== "module" || versionData.main);

  return {
    nodeVersion,
    isESM,
    isCJS,
    hasTypes,
  };
}
