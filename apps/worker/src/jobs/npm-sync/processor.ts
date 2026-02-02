/**
 * npm Sync Processor
 *
 * Job processing logic for npm package sync.
 */

import type { Job } from "bullmq";
import {
  fetchPackageMetadata,
  fetchDownloads,
  deletePackage,
  upsertPackages,
  type PackageDocument,
  type NpmPackageMetadata,
} from "../../clients";
import { extractCompatibility } from "../../lib/compatibility";
import type { SyncJobData, BulkSyncJobData } from "./types";

/**
 * Transform npm metadata to Typesense document
 */
export function transformToDocument(metadata: NpmPackageMetadata, downloads = 0): PackageDocument {
  const latestVersion = metadata["dist-tags"]?.latest || "0.0.0";
  const versionData = metadata.versions?.[latestVersion];

  const compatibility = versionData
    ? extractCompatibility(versionData, metadata.name)
    : {
        nodeVersion: undefined,
        isESM: false,
        isCJS: false,
        hasTypes: false,
      };

  let author: string | undefined;
  if (typeof metadata.author === "string") {
    author = metadata.author;
  } else if (metadata.author?.name) {
    author = metadata.author.name;
  }

  let repository: string | undefined;
  if (typeof metadata.repository === "string") {
    repository = metadata.repository;
  } else if (metadata.repository?.url) {
    repository = metadata.repository.url.replace(/^git\+/, "").replace(/\.git$/, "");
  }

  const dependencies = Object.keys(versionData?.dependencies || {}).length;

  const maintainers = metadata.maintainers
    ?.map((m) => m.name)
    .filter((n): n is string => Boolean(n));

  const peerDeps = versionData?.peerDependencies || {};
  const directDeps = versionData?.dependencies || {};

  const lastUpdated = metadata.time?.modified
    ? new Date(metadata.time.modified).getTime()
    : Date.now();
  const daysSinceUpdate = (Date.now() - lastUpdated) / (1000 * 60 * 60 * 24);
  const maintenanceScore = Math.max(0, Math.min(1, 1 - daysSinceUpdate / 730));

  const scripts = versionData?.scripts || {};
  const hasInstallScripts = Boolean(scripts.preinstall || scripts.install || scripts.postinstall);

  let funding: string | undefined;
  const fundingData = versionData?.funding || metadata.funding;
  if (fundingData) {
    if (typeof fundingData === "string") {
      funding = fundingData;
    } else if (Array.isArray(fundingData) && fundingData[0]?.url) {
      funding = fundingData[0].url;
    } else if (typeof fundingData === "object" && "url" in fundingData) {
      funding = fundingData.url;
    }
  }

  return {
    id: metadata.name,
    name: metadata.name,
    description: metadata.description?.slice(0, 500),
    keywords: metadata.keywords?.slice(0, 20),
    author,
    version: latestVersion,
    license: metadata.license,
    homepage: metadata.homepage,
    repository,
    downloads,
    updated: lastUpdated,
    created: metadata.time?.created ? new Date(metadata.time.created).getTime() : Date.now(),
    hasTypes: compatibility.hasTypes,
    isESM: compatibility.isESM,
    isCJS: compatibility.isCJS,
    dependencies,
    maintainers: maintainers?.slice(0, 10),
    nodeVersion: compatibility.nodeVersion,
    peerDependencies: Object.keys(peerDeps).length > 0 ? JSON.stringify(peerDeps) : undefined,
    directDependencies: Object.keys(directDeps).length > 0 ? JSON.stringify(directDeps) : undefined,
    deprecated: Boolean(metadata.deprecated),
    deprecatedMessage: metadata.deprecated || undefined,
    maintenanceScore: maintenanceScore > 0 ? Math.round(maintenanceScore * 100) / 100 : undefined,
    hasInstallScripts: hasInstallScripts || undefined,
    funding,
  };
}

/**
 * Process a single package sync job
 */
export async function processSyncJob(job: Job<SyncJobData>): Promise<void> {
  const { name, deleted } = job.data;

  if (deleted) {
    await deletePackage(name);
    console.log(`[${job.id}] Deleted: ${name}`);
    return;
  }

  if (name.startsWith("_design/")) {
    console.log(`[${job.id}] Skipped (design doc): ${name}`);
    return;
  }

  const metadata = await fetchPackageMetadata(name);
  if (!metadata) {
    console.log(`[${job.id}] Skipped (not found): ${name}`);
    return;
  }

  const downloads = await fetchDownloads([name]);
  const downloadCount = downloads.get(name) || 0;

  const doc = transformToDocument(metadata, downloadCount);
  await upsertPackages([doc]);

  console.log(
    `[${job.id}] Synced: ${name} v${doc.version} (${doc.downloads.toLocaleString()} downloads/wk)`,
  );
}

/**
 * Process a bulk sync job (multiple packages)
 */
export async function processBulkSyncJob(job: Job<BulkSyncJobData>): Promise<void> {
  const { names, phase } = job.data;

  console.log(`[${job.id}] Processing bulk sync: ${names.length} packages (phase ${phase || "N/A"})`);

  const metadataPromises = names.map((name) => fetchPackageMetadata(name));
  const metadataResults = await Promise.all(metadataPromises);

  const validPackages = metadataResults.filter(
    (m): m is NonNullable<typeof m> => m !== null,
  );

  if (validPackages.length === 0) {
    console.log(`[${job.id}] No valid packages in batch`);
    return;
  }

  const packageNames = validPackages.map((p) => p.name);
  const downloads = await fetchDownloads(packageNames);

  const documents = validPackages.map((metadata) =>
    transformToDocument(metadata, downloads.get(metadata.name) || 0),
  );

  await upsertPackages(documents);

  console.log(`[${job.id}] Bulk synced: ${documents.length}/${names.length} packages`);

  await job.updateProgress(100);
}
