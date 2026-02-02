/**
 * External API Clients
 *
 * Re-exports all external service clients.
 */

export * from "./github";
// npm.ts and typesense.ts both export getPackage - use explicit exports
export {
  type DownloadsData,
  getDeprecationMessage,
  getDownloads,
  getLatestVersion,
  getPackage as getNpmPackage,
  getPublishedAt,
  hasTypes,
  isCJS,
  isDeprecated,
  isESM,
  type PackageMetadata,
} from "./npm";
export * from "./npms";
export * from "./osv";

export {
  findAlternativesByCategory,
  getPackage as getTypesensePackage,
  getPackages,
  type PackageDocument,
  searchPackages,
  typesenseClient,
} from "./typesense";
