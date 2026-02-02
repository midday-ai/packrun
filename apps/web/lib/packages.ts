/**
 * Package data access layer
 *
 * Fetches package data from npm registry and renders README.
 * Results are cached via Next.js "use cache" directive for instant subsequent loads.
 */

import { fetchAndRenderReadme } from "@v1/readme-renderer";
import { cacheLife } from "next/cache";

/**
 * Package data structure
 */
export interface CachedPackage {
  // Core metadata
  name: string;
  version: string;
  description?: string;
  license?: string;
  homepage?: string;
  repository?: string;
  author?: string;
  keywords?: string[];

  // Computed analysis
  hasTypes: boolean;
  isESM: boolean;
  isCJS: boolean;
  nodeVersion?: string;
  deprecated: boolean;
  deprecatedMessage?: string;

  // Dependencies
  dependencyCount: number;
  dependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;

  // Stats
  downloads: number;
  unpackedSize?: number;
  maintainers?: string[];

  // Pre-rendered content
  readmeHtml?: string;

  // Timestamps
  created: number;
  updated: number;
  syncedAt: number;

  // Security & quality (optional, from enhanced sync)
  vulnerabilities?: number;
  vulnCritical?: number;
  vulnHigh?: number;
  hasInstallScripts?: boolean;

  // Popularity & metadata (optional)
  stars?: number;
  typesPackage?: string;
  funding?: string;
}

/**
 * Get package data by name.
 * Uses "use cache" directive - result is cached by Next.js for fast subsequent loads.
 */
export async function getCachedPackage(name: string): Promise<CachedPackage | null> {
  "use cache";
  cacheLife("hours"); // Cache for 1 hour, revalidate after

  return fetchFromNpmRegistry(name);
}

/**
 * Fetch package data directly from npm registry
 */
async function fetchFromNpmRegistry(name: string): Promise<CachedPackage | null> {
  try {
    // Fetch package metadata from npm
    const response = await fetch(`https://registry.npmjs.org/${encodeURIComponent(name)}`, {
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      throw new Error(`npm registry returned ${response.status}`);
    }

    const data = await response.json();
    const latestVersion = data["dist-tags"]?.latest;
    if (!latestVersion) {
      return null;
    }

    const versionData = data.versions?.[latestVersion];
    if (!versionData) {
      return null;
    }

    // Fetch weekly downloads
    let downloads = 0;
    try {
      const downloadsResponse = await fetch(
        `https://api.npmjs.org/downloads/point/last-week/${encodeURIComponent(name)}`,
      );
      if (downloadsResponse.ok) {
        const downloadsData = await downloadsResponse.json();
        downloads = downloadsData.downloads || 0;
      }
    } catch {
      // Ignore download fetch errors
    }

    // Parse repository URL
    let repository: string | undefined;
    if (versionData.repository) {
      if (typeof versionData.repository === "string") {
        repository = versionData.repository;
      } else if (versionData.repository.url) {
        repository = versionData.repository.url
          .replace(/^git\+/, "")
          .replace(/\.git$/, "")
          .replace(/^git:\/\//, "https://")
          .replace(/^ssh:\/\/git@/, "https://");
      }
    }

    // Detect module type
    const isESM = versionData.type === "module" || !!versionData.module || !!versionData.exports;
    const isCJS = versionData.type === "commonjs" || (!versionData.type && !!versionData.main);

    // Detect TypeScript
    const hasTypes =
      !!versionData.types ||
      !!versionData.typings ||
      Object.keys(versionData.dependencies || {}).includes("typescript") ||
      Object.keys(versionData.devDependencies || {}).includes("typescript");

    // Parse author
    let author: string | undefined;
    if (versionData.author) {
      if (typeof versionData.author === "string") {
        author = versionData.author;
      } else if (versionData.author.name) {
        author = versionData.author.name;
      }
    }

    // Parse maintainers
    const maintainers = (versionData.maintainers || data.maintainers || [])
      .map((m: { name?: string; email?: string } | string) => (typeof m === "string" ? m : m.name))
      .filter(Boolean) as string[];

    // Get timestamps
    const timeData = data.time || {};
    const created = timeData.created ? new Date(timeData.created).getTime() : 0;
    const updated = timeData[latestVersion] ? new Date(timeData[latestVersion]).getTime() : 0;

    // Render README HTML
    let readmeHtml: string | undefined;
    try {
      readmeHtml =
        (await fetchAndRenderReadme({
          name: versionData.name || name,
          readme: data.readme,
          readmeFilename: data.readmeFilename,
          repository: versionData.repository,
          "dist-tags": data["dist-tags"],
        })) || undefined;
    } catch (error) {
      console.error(`Failed to render README for ${name}:`, error);
    }

    // Check for install scripts (security concern)
    const scripts = versionData.scripts || {};
    const hasInstallScripts = Boolean(scripts.preinstall || scripts.install || scripts.postinstall);

    // Extract funding URL
    let funding: string | undefined;
    const fundingData = versionData.funding || data.funding;
    if (fundingData) {
      if (typeof fundingData === "string") {
        funding = fundingData;
      } else if (Array.isArray(fundingData) && fundingData[0]?.url) {
        funding = fundingData[0].url;
      } else if (typeof fundingData === "object" && "url" in fundingData) {
        funding = (fundingData as { url: string }).url;
      }
    }

    return {
      name: versionData.name || name,
      version: latestVersion,
      description: versionData.description,
      license:
        typeof versionData.license === "string" ? versionData.license : versionData.license?.type,
      homepage: versionData.homepage,
      repository,
      author,
      keywords: versionData.keywords || [],
      hasTypes,
      isESM,
      isCJS,
      nodeVersion: versionData.engines?.node,
      deprecated: !!versionData.deprecated,
      deprecatedMessage:
        typeof versionData.deprecated === "string" ? versionData.deprecated : undefined,
      dependencyCount: Object.keys(versionData.dependencies || {}).length,
      dependencies: versionData.dependencies,
      peerDependencies: versionData.peerDependencies,
      downloads,
      unpackedSize: versionData.dist?.unpackedSize,
      maintainers,
      readmeHtml,
      created,
      updated,
      syncedAt: 0,
      // Security & quality
      hasInstallScripts: hasInstallScripts || undefined,
      funding,
    };
  } catch (error) {
    console.error(`Failed to fetch ${name} from npm registry:`, error);
    return null;
  }
}

/**
 * Format bytes to human readable string
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${Number.parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/**
 * Format number with K/M suffix
 */
export function formatNumber(num: number): string {
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)}M`;
  }
  if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}K`;
  }
  return num.toString();
}
