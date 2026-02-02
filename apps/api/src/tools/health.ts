/**
 * Package Health Tool
 *
 * Comprehensive package assessment - one call returns everything an AI needs.
 * Falls back to npm registry if package not in Typesense, then queues for sync.
 */

import { fetchGitHubDataForPackage, type GitHubData } from "../lib/clients/github";
import {
  getLatestVersion,
  getPackage as getNpmPackage,
  hasTypes as npmHasTypes,
  isCJS as npmIsCJS,
  isDeprecated as npmIsDeprecated,
  isESM as npmIsESM,
  type PackageMetadata,
} from "../lib/clients/npm";
import { fetchNpmsScores, type NpmsScores } from "../lib/clients/npms";
import {
  findAlternativesByCategory,
  getPackage,
  type PackageDocument,
} from "../lib/clients/typesense";
import {
  type DownloadTrend,
  getDownloadTrend,
  getPackageDetails,
  getSecuritySignals,
  type PackageDetails,
  type SecuritySignals,
} from "../lib/enrichment";
import {
  computeHealthAssessment,
  generateRecommendation,
  type HealthAssessment,
} from "../lib/health-score";
import { queuePackageSync } from "../lib/queue";
import { CacheKey, cache, TTL } from "../lib/cache";
import { formatReplacement, type ReplacementInfo } from "../lib/replacements";

/**
 * Full health response schema
 */
export interface PackageHealthResponse {
  name: string;
  version: string;
  description?: string;
  category?: string;

  health: HealthAssessment;

  security: {
    vulnerabilities: {
      total: number;
      critical: number;
      high: number;
      medium: number;
      low: number;
    };
    supplyChain: {
      hasProvenance: boolean;
      hasInstallScripts: boolean;
      hasGitDeps: boolean;
      hasHttpDeps: boolean;
      maintainersCount: number;
    };
    license: {
      spdx?: string;
      type?: string;
      risk: "low" | "medium" | "high" | "unknown";
    };
  };

  quality: {
    hasReadme: boolean;
    readmeSize: number;
    hasTests: boolean;
    hasTestScript: boolean;
    isStable: boolean;
    scores?: NpmsScores;
  };

  compatibility: {
    types: "built-in" | "@types" | "none";
    typesPackage?: string;
    moduleFormat?: string;
    sideEffects?: boolean;
    engines?: { node?: string; npm?: string };
    os?: string[];
    cpu?: string[];
  };

  size: {
    unpackedSize?: number;
    unpackedSizeHuman?: string;
    fileCount?: number;
    dependencies: number;
  };

  popularity: {
    weeklyDownloads: number;
    downloadTrend?: string;
    dependents?: number;
    stars?: number;
  };

  activity: {
    lastUpdated: string;
    lastReleaseAge: number;
    maintainersCount: number;
  };

  github?: GitHubData;

  author?: {
    name?: string;
    github?: string;
  };

  funding?: {
    url?: string;
    platforms: string[];
  };

  cli?: {
    isCLI: boolean;
    commands: string[];
  };

  links: {
    npm: string;
    homepage?: string;
    repository?: string;
    bugs?: string;
  };

  replacement?: ReplacementInfo;

  alternatives: Array<{
    name: string;
    downloads: number;
    stars?: number;
    healthScore?: number;
    reason?: string;
  }>;

  recommendation: string;
}

/**
 * Get comprehensive package health
 */
export async function getPackageHealth(name: string): Promise<PackageHealthResponse | null> {
  // 1. Check full health cache first
  const healthCacheKey = CacheKey.health(name);
  const cached = await cache.get<PackageHealthResponse>(healthCacheKey);
  if (cached) return cached;

  // 2. Get core data from Typesense
  let pkg = await getPackage(name);
  let fromNpm = false;

  // 3. If not in Typesense, fallback to npm registry
  if (!pkg) {
    const npmPkg = await getNpmPackage(name);
    if (!npmPkg) return null;

    // Queue for sync to Typesense (async, don't await)
    queuePackageSync(name).catch((err) =>
      console.error(`[Health] Failed to queue ${name} for sync:`, err),
    );

    // Convert npm data to PackageDocument format
    pkg = npmToPackageDocument(npmPkg);
    fromNpm = true;
  }

  // 4. Fetch enriched data in parallel
  const [scores, details, security, trend, github] = await Promise.all([
    fetchNpmsScores(name),
    getPackageDetails(name),
    getSecuritySignals(name),
    getDownloadTrend(name),
    pkg.repository ? fetchGitHubDataForPackage(name, pkg.repository) : null,
  ]);

  // 5. Get alternatives by category (skip if from npm - no category data)
  let alternatives: PackageDocument[] = [];
  if (pkg.inferredCategory && !fromNpm) {
    alternatives = await findAlternativesByCategory(pkg.inferredCategory, name, 5);
  }

  // 6. Check for replacements (instant O(1) lookup)
  const replacement = formatReplacement(name);

  // 7. Compute health assessment
  const health = computeHealthAssessment(pkg, scores, security, trend);

  // 8. Build response
  const response = buildHealthResponse(
    pkg,
    health,
    scores,
    details,
    security,
    trend,
    github,
    alternatives,
    replacement,
  );

  // 9. Cache for 1 hour (shorter if from npm since it will be updated after sync)
  await cache.set(healthCacheKey, response, fromNpm ? TTL.HEALTH / 4 : TTL.HEALTH);

  return response;
}

/**
 * Convert npm PackageMetadata to PackageDocument format
 */
function npmToPackageDocument(npm: PackageMetadata): PackageDocument {
  const latestVersion = getLatestVersion(npm);
  const versionData = npm.versions?.[latestVersion];

  // Parse repository URL
  let repository: string | undefined;
  if (typeof npm.repository === "string") {
    repository = npm.repository;
  } else if (npm.repository?.url) {
    repository = npm.repository.url
      .replace(/^git\+/, "")
      .replace(/\.git$/, "")
      .replace(/^git:\/\//, "https://")
      .replace(/^ssh:\/\/git@/, "https://");
  }

  // Parse author
  let author: string | undefined;
  if (typeof npm.author === "string") {
    author = npm.author;
  } else if (npm.author?.name) {
    author = npm.author.name;
  }

  // Get timestamps
  const created = npm.time?.created ? new Date(npm.time.created).getTime() : Date.now();
  const updated = npm.time?.[latestVersion]
    ? new Date(npm.time[latestVersion] as string).getTime()
    : Date.now();

  // Parse maintainers
  const maintainers = (npm.maintainers || [])
    .map((m) => m.name)
    .filter((n): n is string => Boolean(n));

  return {
    id: npm.name,
    name: npm.name,
    description: npm.description,
    version: latestVersion,
    license: npm.license,
    homepage: npm.homepage,
    repository,
    author,
    keywords: npm.keywords,
    downloads: 0, // Will be fetched via enrichment
    updated,
    created,
    hasTypes: npmHasTypes(npm),
    isESM: npmIsESM(npm),
    isCJS: npmIsCJS(npm),
    dependencies: Object.keys(versionData?.dependencies || {}).length,
    maintainers,
    nodeVersion: versionData?.engines?.node,
    deprecated: npmIsDeprecated(npm),
    deprecatedMessage:
      typeof npm.deprecated === "string"
        ? npm.deprecated
        : typeof versionData?.deprecated === "string"
          ? versionData.deprecated
          : undefined,
    unpackedSize: versionData?.dist?.unpackedSize,
    // These fields won't be available from npm (only from Typesense after sync)
    inferredCategory: undefined,
    moduleFormat: npmIsESM(npm)
      ? npmIsCJS(npm)
        ? "dual"
        : "esm"
      : npmIsCJS(npm)
        ? "cjs"
        : "unknown",
    hasBin: undefined,
    licenseType: undefined,
    hasProvenance: undefined,
    isStable: undefined,
    authorGithub: undefined,
  };
}

function buildHealthResponse(
  pkg: PackageDocument,
  health: HealthAssessment,
  scores: NpmsScores | null,
  details: PackageDetails | null,
  security: SecuritySignals | null,
  trend: DownloadTrend | null,
  github: GitHubData | null,
  alternatives: PackageDocument[],
  replacement: ReplacementInfo | null,
): PackageHealthResponse {
  const daysSinceUpdate = Math.floor((Date.now() - pkg.updated) / (1000 * 60 * 60 * 24));

  // Determine types status
  let typesStatus: "built-in" | "@types" | "none" = "none";
  if (pkg.hasTypes) typesStatus = "built-in";
  else if (pkg.typesPackage) typesStatus = "@types";

  // Determine license risk
  let licenseRisk: "low" | "medium" | "high" | "unknown" = "unknown";
  if (pkg.licenseType === "permissive") licenseRisk = "low";
  else if (pkg.licenseType === "copyleft") licenseRisk = "medium";
  else if (pkg.licenseType === "proprietary") licenseRisk = "high";

  // Format unpacked size
  let unpackedSizeHuman: string | undefined;
  if (pkg.unpackedSize) {
    if (pkg.unpackedSize > 1_000_000) {
      unpackedSizeHuman = `${(pkg.unpackedSize / 1_000_000).toFixed(1)} MB`;
    } else if (pkg.unpackedSize > 1_000) {
      unpackedSizeHuman = `${(pkg.unpackedSize / 1_000).toFixed(1)} KB`;
    } else {
      unpackedSizeHuman = `${pkg.unpackedSize} B`;
    }
  }

  // Format alternatives
  const formattedAlternatives = alternatives.map((alt) => ({
    name: alt.name,
    downloads: alt.downloads,
    stars: alt.stars,
    reason: alt.description?.slice(0, 100),
  }));

  // Generate recommendation
  const recommendation = generateRecommendation(
    pkg,
    health,
    formattedAlternatives,
    replacement || undefined,
  );

  return {
    name: pkg.name,
    version: pkg.version,
    description: pkg.description,
    category: pkg.inferredCategory,

    health,

    security: {
      vulnerabilities: {
        total: pkg.vulnerabilities || 0,
        critical: pkg.vulnCritical || 0,
        high: pkg.vulnHigh || 0,
        medium: 0,
        low: 0,
      },
      supplyChain: {
        hasProvenance: pkg.hasProvenance || false,
        hasInstallScripts: pkg.hasInstallScripts || false,
        hasGitDeps: security?.hasGitDeps || false,
        hasHttpDeps: security?.hasHttpDeps || false,
        maintainersCount: details?.maintainersCount || pkg.maintainers?.length || 0,
      },
      license: {
        spdx: pkg.license,
        type: pkg.licenseType,
        risk: licenseRisk,
      },
    },

    quality: {
      hasReadme: (security?.readmeSize || 0) > 0,
      readmeSize: security?.readmeSize || 0,
      hasTests: security?.hasTests || false,
      hasTestScript: security?.hasTestScript || false,
      isStable: pkg.isStable || false,
      scores: scores || undefined,
    },

    compatibility: {
      types: typesStatus,
      typesPackage: pkg.typesPackage,
      moduleFormat:
        pkg.moduleFormat ||
        (pkg.isESM && pkg.isCJS ? "dual" : pkg.isESM ? "esm" : pkg.isCJS ? "cjs" : undefined),
      sideEffects: details?.sideEffects,
      engines: details ? { node: details.engineNode, npm: details.engineNpm } : undefined,
      os: details?.os,
      cpu: details?.cpu,
    },

    size: {
      unpackedSize: pkg.unpackedSize,
      unpackedSizeHuman,
      fileCount: details?.fileCount,
      dependencies: pkg.dependencies,
    },

    popularity: {
      weeklyDownloads: pkg.downloads,
      downloadTrend: trend?.trend,
      dependents: pkg.dependents,
      stars: pkg.stars || github?.stars,
    },

    activity: {
      lastUpdated: new Date(pkg.updated).toISOString(),
      lastReleaseAge: daysSinceUpdate,
      maintainersCount: details?.maintainersCount || pkg.maintainers?.length || 0,
    },

    github: github || undefined,

    author: pkg.author
      ? {
          name: pkg.author,
          github: pkg.authorGithub,
        }
      : undefined,

    funding: details?.fundingUrl
      ? {
          url: details.fundingUrl,
          platforms: details.fundingPlatforms,
        }
      : undefined,

    cli:
      pkg.hasBin && details?.binCommands?.length
        ? {
            isCLI: true,
            commands: details.binCommands,
          }
        : undefined,

    links: {
      npm: `https://www.npmjs.com/package/${pkg.name}`,
      homepage: pkg.homepage,
      repository: pkg.repository,
      bugs: details?.bugsUrl,
    },

    replacement: replacement || undefined,

    alternatives: formattedAlternatives,

    recommendation,
  };
}
