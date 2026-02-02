/**
 * npm Registry API Client for Worker
 *
 * Re-exports from @v1/data/npm with worker-specific additions.
 */

// Re-export everything from shared package
// Re-export batch function with original name for backwards compatibility
export {
  checkTypesPackage,
  fetchDownloads as fetchSingleDownloads,
  fetchDownloadsBatch as fetchDownloads,
  fetchPackageMetadata,
  getAuthorName,
  getDeprecationMessage,
  getLatestVersion,
  getPublishedAt,
  getRepositoryUrl,
  getVersionData,
  hasBuiltInTypes,
  isCJS,
  isDeprecated,
  isESM,
  type NpmDownloadsResponse,
  type NpmPackageMetadata,
  type NpmVersionData,
} from "@v1/data/npm";

/**
 * Batch check @types packages for multiple packages
 * Worker-specific: uses batch processing for efficiency
 */
export async function checkTypesPackagesBatch(
  packages: Array<{ name: string; hasTypes: boolean }>,
): Promise<Map<string, string>> {
  const { checkTypesPackage } = await import("@v1/data/npm");
  const results = new Map<string, string>();
  const packagesWithoutTypes = packages.filter((p) => !p.hasTypes);
  const batchSize = 20;

  for (let i = 0; i < packagesWithoutTypes.length; i += batchSize) {
    const batch = packagesWithoutTypes.slice(i, i + batchSize);
    const promises = batch.map(async (pkg) => {
      const typesPackage = await checkTypesPackage(pkg.name);
      if (typesPackage) {
        results.set(pkg.name, typesPackage);
      }
    });
    await Promise.all(promises);
  }

  return results;
}
