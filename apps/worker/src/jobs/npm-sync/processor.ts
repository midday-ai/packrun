/**
 * npm Sync Processor
 *
 * Job processing logic for npm package sync.
 * Now includes notification creation for package updates
 * and auto-detection of upcoming releases.
 */

import { db, isDatabaseAvailable } from "@packrun/db/client";
import { inferCategory } from "@packrun/decisions";
import type { Job } from "bullmq";
import {
  deletePackage,
  fetchDownloads,
  fetchPackageMetadata,
  type NpmPackageMetadata,
  type NpmVersionData,
  type PackageDocument,
  upsertPackages,
} from "../../clients";
import { extractCompatibility } from "../../lib/compatibility";
import { dispatchNotifications } from "../../lib/notification-dispatcher";
import { enrichPackageUpdate } from "../../lib/notification-enrichment";
import { checkAndDispatchReleases } from "../../lib/release-detector";
import { getPreviousVersion } from "../../lib/version-tracker";
import type { BulkSyncJobData, SyncJobData } from "./types";

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

  // NEW: Extract fields for search/filter
  const inferredCategory = metadata.keywords ? inferCategory(metadata.keywords) : null;
  const moduleFormat = getModuleFormat(versionData, compatibility);
  const bin = versionData?.bin;
  const hasBin = Boolean(bin && Object.keys(bin).length > 0);
  const licenseType = classifyLicense(metadata.license);
  const dist = versionData?.dist;
  const hasProvenance = Boolean(dist?.attestations);
  const unpackedSize = dist?.unpackedSize;
  const isStable = isVersionStable(latestVersion);
  const authorGithub = extractGithubUsername(repository);

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
    deprecatedMessage: typeof metadata.deprecated === "string" ? metadata.deprecated : undefined,
    maintenanceScore: maintenanceScore > 0 ? Math.round(maintenanceScore * 100) / 100 : undefined,
    hasInstallScripts: hasInstallScripts || undefined,
    funding,

    // NEW: Fields for search/filter
    inferredCategory: inferredCategory || undefined,
    moduleFormat,
    hasBin: hasBin || undefined,
    licenseType,
    hasProvenance: hasProvenance || undefined,
    unpackedSize,
    isStable,
    authorGithub,
  };
}

/**
 * Determine module format from package data
 */
function getModuleFormat(
  versionData: NpmVersionData | undefined,
  compatibility: { isESM: boolean; isCJS: boolean },
): string {
  if (compatibility.isESM && compatibility.isCJS) return "dual";
  if (compatibility.isESM) return "esm";
  if (compatibility.isCJS) return "cjs";
  // Check type field as fallback
  if (versionData?.type === "module") return "esm";
  if (versionData?.type === "commonjs") return "cjs";
  return "unknown";
}

/**
 * Classify license type for filtering
 */
function classifyLicense(license: string | { type?: string } | undefined): string {
  if (!license) return "unknown";
  // Handle license as object (e.g., { type: "MIT", url: "..." })
  const licenseStr = typeof license === "string" ? license : license.type;
  if (!licenseStr) return "unknown";
  const upper = licenseStr.toUpperCase();
  // Permissive licenses
  if (/^(MIT|ISC|BSD|APACHE|UNLICENSE|CC0|WTFPL|0BSD)/i.test(upper)) {
    return "permissive";
  }
  // Copyleft licenses
  if (/^(GPL|LGPL|AGPL|MPL|EPL|EUPL|CDDL)/i.test(upper)) {
    return "copyleft";
  }
  // Proprietary/commercial
  if (/^(PROPRIETARY|COMMERCIAL|SEE LICENSE|UNLICENSED)/i.test(upper)) {
    return "proprietary";
  }
  return "unknown";
}

/**
 * Check if version is stable (>= 1.0.0)
 */
function isVersionStable(version: string): boolean {
  const match = version.match(/^(\d+)\./);
  if (!match || !match[1]) return false;
  return parseInt(match[1], 10) >= 1;
}

/**
 * Extract GitHub org/username from repository URL
 */
function extractGithubUsername(repoUrl: string | undefined): string | undefined {
  if (!repoUrl) return undefined;
  const match = repoUrl.match(/github\.com\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : undefined;
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

  // Get previous version BEFORE updating Typesense (for notification comparison)
  const previousVersion = isDatabaseAvailable(db) ? await getPreviousVersion(name) : null;

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

  // Create notifications if version changed
  if (isDatabaseAvailable(db) && previousVersion && previousVersion !== doc.version) {
    try {
      // Enrich the update with security/changelog information
      const enrichment = await enrichPackageUpdate(
        name,
        previousVersion,
        doc.version,
        doc.repository,
      );

      // Dispatch notifications to users who follow this package
      const { notified, skipped } = await dispatchNotifications(
        name,
        enrichment,
        previousVersion,
        doc.version,
      );

      if (notified > 0) {
        console.log(
          `[${job.id}] Notifications: ${notified} sent, ${skipped} skipped (${enrichment.severity})`,
        );
      }
    } catch (error) {
      // Don't fail the sync job if notifications fail
      console.error(`[${job.id}] Notification error for ${name}:`, error);
    }
  }

  // Check for matching upcoming releases and dispatch notifications
  if (isDatabaseAvailable(db)) {
    try {
      const releasesMatched = await checkAndDispatchReleases(name, doc.version);
      if (releasesMatched > 0) {
        console.log(
          `[${job.id}] Release detected: ${releasesMatched} release(s) marked as launched`,
        );
      }
    } catch (error) {
      // Don't fail the sync job if release detection fails
      console.error(`[${job.id}] Release detection error for ${name}:`, error);
    }
  }
}

/**
 * Process a bulk sync job (multiple packages)
 */
export async function processBulkSyncJob(job: Job<BulkSyncJobData>): Promise<void> {
  const { names } = job.data;

  console.log(`[${job.id}] Processing bulk sync: ${names.length} packages`);

  const metadataPromises = names.map((name) => fetchPackageMetadata(name));
  const metadataResults = await Promise.all(metadataPromises);

  const validPackages = metadataResults.filter((m): m is NonNullable<typeof m> => m !== null);

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
