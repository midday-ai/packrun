/**
 * npm Registry API client for API Server
 *
 * Re-exports from @packrun/data/npm with additional aliases for compatibility.
 */

// Also export the types with API-compatible names
export type {
  NpmDownloadsResponse as DownloadsData,
  NpmPackageMetadata as PackageMetadata,
  NpmSearchResult,
} from "@packrun/data/npm";
// Re-export everything from shared package
// Re-export with API-compatible names
export {
  checkTypesPackage,
  fetchDownloads,
  fetchDownloads as getDownloads,
  fetchDownloadsBatch,
  fetchPackageMetadata,
  fetchPackageMetadata as getPackage,
  fetchReadmeFromCdn,
  getAuthorName,
  getDeprecationMessage,
  getLatestVersion,
  getPublishedAt,
  getRepositoryUrl,
  getVersionData,
  hasBuiltInTypes as hasTypes,
  isCJS,
  isDeprecated,
  isESM,
  type NpmDownloadsResponse,
  type NpmPackageMetadata,
  type NpmVersionData,
  searchNpmRegistry,
} from "@packrun/data/npm";
