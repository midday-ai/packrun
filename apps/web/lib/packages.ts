/**
 * Package data access layer
 *
 * Fetches package data from the v1.run API, with fallback to npm registry.
 * Caching is handled by Next.js ISR and Cloudflare CDN.
 */

import { fetchPackageHealth, type PackageHealthResponse } from "./api";

/**
 * Package data structure
 */
export interface PackageData {
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

  // Security & quality (optional)
  hasInstallScripts?: boolean;

  // Popularity & metadata (optional)
  stars?: number;
  typesPackage?: string;
  funding?: string;

  // Health data from API (new)
  health?: PackageHealthResponse;
}

// Keep old type alias for backwards compatibility
export type CachedPackage = PackageData;

/**
 * Get package data by name.
 * Fetches everything from API (cached via Cloudflare).
 */
export async function getPackage(name: string): Promise<PackageData | null> {
  const health = await fetchPackageHealth(name);

  if (health) {
    const pkg = healthToPackageData(health);
    // Render readme from API response
    if (health.readme) {
      pkg.readmeHtml = await renderReadme(health.readme, name, health.links.repository);
    }
    return pkg;
  }

  // Fallback to direct npm fetch (includes readme)
  console.log(`[packages] API miss for ${name}, falling back to npm`);
  return getPackageFromNpm(name);
}

/**
 * Render markdown readme to HTML
 */
async function renderReadme(
  readme: string,
  packageName: string,
  repository?: string,
): Promise<string | undefined> {
  try {
    const { renderReadmeHtml, parseRepositoryInfo } = await import("@v1/readme-renderer");
    const repoInfo = parseRepositoryInfo(repository);
    const result = await renderReadmeHtml(readme, packageName, repoInfo);
    return result.html || undefined;
  } catch (error) {
    console.error(`[packages] Failed to render readme for ${packageName}:`, error);
    return undefined;
  }
}

/**
 * Convert API health response to PackageData format
 */
function healthToPackageData(health: PackageHealthResponse): PackageData {
  return {
    name: health.name,
    version: health.version,
    description: health.description,
    license: health.security.license.spdx,
    homepage: health.links.homepage,
    repository: health.links.repository,
    author: health.author?.name,
    keywords: [], // Not in health response, but OK for display
    hasTypes: health.compatibility.types !== "none",
    isESM:
      health.compatibility.moduleFormat === "esm" || health.compatibility.moduleFormat === "dual",
    isCJS:
      health.compatibility.moduleFormat === "cjs" || health.compatibility.moduleFormat === "dual",
    nodeVersion: health.compatibility.engines?.node,
    deprecated: health.health.status === "deprecated",
    deprecatedMessage: health.replacement?.reason,
    dependencyCount: health.size.dependencies,
    downloads: health.popularity.weeklyDownloads,
    unpackedSize: health.size.unpackedSize,
    maintainers: [], // Could be added if needed
    created: 0, // Not in health response
    updated: new Date(health.activity.lastUpdated).getTime(),
    hasInstallScripts: health.security.supplyChain.hasInstallScripts || undefined,
    stars: health.github?.stars || health.popularity.stars,
    typesPackage: health.compatibility.typesPackage,
    funding: health.funding?.url,
    // Include full health data for enhanced display
    health,
  };
}

/**
 * Fallback: Fetch directly from npm registry
 */
async function getPackageFromNpm(name: string): Promise<PackageData | null> {
  try {
    // Fetch package metadata from npm
    const response = await fetch(`https://registry.npmjs.org/${encodeURIComponent(name)}`, {
      headers: {
        Accept: "application/json",
      },
      next: { revalidate: 86400 }, // 24h - warning for >2MB packages is expected
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
    const readmeHtml = data.readme
      ? await renderReadme(data.readme, versionData.name || name, repository)
      : undefined;

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
      hasInstallScripts: hasInstallScripts || undefined,
      funding,
    };
  } catch (error) {
    console.error(`Failed to fetch ${name} from npm registry:`, error);
    return null;
  }
}

// Alias for backwards compatibility
export const getCachedPackage = getPackage;

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
