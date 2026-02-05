/**
 * Package Health Tool
 *
 * Comprehensive package assessment - one call returns everything an AI needs.
 * Fetches data from authoritative sources (npm, GitHub) with smart caching:
 * - Downloads: Typesense first (already synced), npm API fallback
 * - Metadata: npm registry (source of truth)
 * - Alternatives: Typesense (search index)
 * Caching: Cloudflare edge cache handles all response caching (24h for health endpoint).
 */

import { fetchNpmsScores, type NpmsScores } from "@packrun/data/npms";
import { fetchVulnerabilities } from "@packrun/data/osv";
import { inferCategory } from "@packrun/decisions";
import { api as log } from "@packrun/logger";
import { healthCache } from "../lib/cache";
import {
  fetchGitHubDataForPackage,
  fetchGitHubReadme,
  type GitHubData,
  parseGitHubUrl,
} from "../lib/clients/github";
import {
  checkTypesPackage,
  fetchReadmeFromCdn,
  getAuthorName,
  getDeprecationMessage,
  getLatestVersion,
  getPackage as getNpmPackage,
  getRepositoryUrl,
  getVersionData,
  hasTypes as npmHasTypes,
  isCJS as npmIsCJS,
  isDeprecated as npmIsDeprecated,
  isESM as npmIsESM,
  type PackageMetadata,
} from "../lib/clients/npm";
import { findAlternativesByCategory, type PackageDocument } from "../lib/clients/typesense";
import {
  type DownloadTrend,
  getDownloadTrend,
  getPackageDetails,
  getSecuritySignals,
  getWeeklyDownloads,
  type PackageDetails,
  type SecuritySignals,
} from "../lib/enrichment";
import {
  computeHealthAssessment,
  generateRecommendation,
  type HealthAssessment,
} from "../lib/health-score";
import { queuePackageSync } from "../lib/queue";
import { formatReplacement, type ReplacementInfo } from "../lib/replacements";
import { stripHtml } from "../lib/utils";

/**
 * Full health response schema
 */
export interface PackageHealthResponse {
  name: string;
  version: string;
  description?: string;
  category?: string;
  readme?: string;

  health: HealthAssessment;

  security: {
    vulnerabilities: {
      total: number;
      critical: number;
      high: number;
      moderate: number;
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
    percentChange?: number;
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
 * Internal package data structure (built from npm registry)
 */
interface PackageData {
  name: string;
  version: string;
  description?: string;
  keywords?: string[];
  author?: string;
  authorGithub?: string;
  license?: string;
  licenseType?: string;
  homepage?: string;
  repository?: string;
  updated: number;
  created: number;
  downloads: number;
  hasTypes: boolean;
  typesPackage?: string;
  isESM: boolean;
  isCJS: boolean;
  moduleFormat?: string;
  dependencies: number;
  maintainers: string[];
  nodeVersion?: string;
  deprecated: boolean;
  deprecatedMessage?: string;
  unpackedSize?: number;
  hasProvenance: boolean;
  hasInstallScripts: boolean;
  isStable: boolean;
  hasBin: boolean;
  binCommands?: string[];
  category?: string;
  vulnerabilities: { total: number; critical: number; high: number; moderate: number; low: number };
}

/**
 * Get comprehensive package health
 *
 * Always fetches from npm registry (source of truth).
 * Uses in-memory LRU cache for fast MCP tool calls (1 hour TTL).
 */
export async function getPackageHealth(name: string): Promise<PackageHealthResponse | null> {
  // Check cache first (fast path for MCP tool calls)
  const cacheKey = `health:${name}`;
  const cached = healthCache.get(cacheKey);
  if (cached) {
    return cached as PackageHealthResponse;
  }

  // 1. Fetch from npm registry (authoritative source)
  const npmPkg = await getNpmPackage(name);
  if (!npmPkg) return null;

  // Queue for Typesense indexing (async, for search only)
  queuePackageSync(name).catch((err) => log.error(`Failed to queue ${name} for sync:`, err));

  // 2. Extract basic data from npm
  const version = getLatestVersion(npmPkg);
  const versionData = getVersionData(npmPkg);
  const repository = getRepositoryUrl(npmPkg);

  // 3. Fetch all enrichment data in parallel
  const [scores, details, security, trend, downloads, github, typesPackage, vulns] =
    await Promise.all([
      fetchNpmsScores(name),
      getPackageDetails(name),
      getSecuritySignals(name),
      getDownloadTrend(name),
      getWeeklyDownloads(name),
      repository ? fetchGitHubDataForPackage(name, repository) : null,
      npmHasTypes(npmPkg) ? null : checkTypesPackage(name),
      fetchVulnerabilities(name, version),
    ]);

  // 4. Build package data from npm + enrichment
  const pkg = buildPackageData(npmPkg, version, versionData, {
    downloads,
    typesPackage: typesPackage || undefined,
    details,
    vulns,
    repository,
  });

  // 5. Fetch README
  let readme = npmPkg.readme;
  if (!readme) {
    readme = (await fetchReadmeFromCdn(name, version)) || undefined;
    if (!readme && repository) {
      const parsed = parseGitHubUrl(repository);
      if (parsed) {
        readme = (await fetchGitHubReadme(parsed.owner, parsed.repo)) || undefined;
      }
    }
  }

  // 6. Get alternatives from Typesense (search index only)
  let alternatives: PackageDocument[] = [];
  if (pkg.category) {
    alternatives = await findAlternativesByCategory(pkg.category, name, 5);
  }

  // 7. Check for known replacements
  const replacement = formatReplacement(name);

  // 8. Compute health score (pass GitHub stars so popular repos get +5)
  const health = computeHealthScore(pkg, scores, security, trend, github);

  // 9. Build response
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
    readme,
  );

  // Cache the result for fast future MCP tool calls
  healthCache.set(cacheKey, response);

  return response;
}

/**
 * Build package data from npm registry response
 */
function buildPackageData(
  npm: PackageMetadata,
  version: string,
  versionData: ReturnType<typeof getVersionData>,
  enrichment: {
    downloads: number;
    typesPackage: string | undefined;
    details: PackageDetails | null;
    vulns: { total: number; critical: number; high: number; moderate: number; low: number } | null;
    repository: string | null;
  },
): PackageData {
  const { downloads, typesPackage, details, vulns } = enrichment;
  const repository = enrichment.repository || undefined;

  // Parse author
  const author = getAuthorName(npm);

  // Get timestamps
  const created = npm.time?.created ? new Date(npm.time.created).getTime() : Date.now();
  // Use 'modified' (last activity on any version) rather than version-specific time
  // This ensures we show when the package was truly last updated, not just when the latest tag was set
  const updated = npm.time?.modified
    ? new Date(npm.time.modified).getTime()
    : npm.time?.[version]
      ? new Date(npm.time[version] as string).getTime()
      : Date.now();

  // Parse maintainers
  const maintainers = (npm.maintainers || [])
    .map((m) => m.name)
    .filter((n): n is string => Boolean(n));

  // Determine module format
  const isESM = npmIsESM(npm);
  const isCJS = npmIsCJS(npm);
  const moduleFormat = isESM && isCJS ? "dual" : isESM ? "esm" : isCJS ? "cjs" : "unknown";

  // Check install scripts
  const scripts = versionData?.scripts || {};
  const hasInstallScripts = Boolean(scripts.preinstall || scripts.install || scripts.postinstall);

  // Check provenance
  const hasProvenance = Boolean(versionData?.dist?.attestations);

  // Check if stable (>= 1.0.0)
  const majorVersion = parseInt(version.split(".")[0] || "0", 10);
  const isStable = majorVersion >= 1;

  // Check bin commands
  const bin = versionData?.bin;
  const hasBin = Boolean(bin && Object.keys(bin).length > 0);
  const binCommands = bin ? Object.keys(bin) : [];

  // Classify license
  const license = npm.license;
  const licenseType = classifyLicense(license);

  // Infer category from keywords
  const category = npm.keywords ? inferCategory(npm.keywords) : null;

  // Extract GitHub username from repository
  const authorGithub = repository ? extractGithubUsername(repository) : undefined;

  return {
    name: npm.name,
    version,
    description: stripHtml(npm.description),
    keywords: npm.keywords,
    author: author || undefined,
    authorGithub,
    license,
    licenseType,
    homepage: npm.homepage,
    repository: repository || undefined,
    updated,
    created,
    downloads,
    hasTypes: npmHasTypes(npm),
    typesPackage,
    isESM,
    isCJS,
    moduleFormat,
    dependencies: Object.keys(versionData?.dependencies || {}).length,
    maintainers,
    nodeVersion: versionData?.engines?.node,
    deprecated: npmIsDeprecated(npm),
    deprecatedMessage: getDeprecationMessage(npm) || undefined,
    unpackedSize: versionData?.dist?.unpackedSize,
    hasProvenance,
    hasInstallScripts,
    isStable,
    hasBin,
    binCommands,
    category: category || undefined,
    vulnerabilities: vulns || { total: 0, critical: 0, high: 0, moderate: 0, low: 0 },
  };
}

/**
 * Classify license type
 */
function classifyLicense(license: string | undefined): string {
  if (!license) return "unknown";
  const upper = license.toUpperCase();
  if (/^(MIT|ISC|BSD|APACHE|UNLICENSE|CC0|WTFPL|0BSD)/i.test(upper)) return "permissive";
  if (/^(GPL|LGPL|AGPL|MPL|EPL|EUPL|CDDL)/i.test(upper)) return "copyleft";
  if (/^(PROPRIETARY|COMMERCIAL|SEE LICENSE|UNLICENSED)/i.test(upper)) return "proprietary";
  return "unknown";
}

/**
 * Extract GitHub username from repository URL
 */
function extractGithubUsername(repoUrl: string): string | undefined {
  const match = repoUrl.match(/github\.com\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : undefined;
}

/**
 * Compute health score from package data
 */
function computeHealthScore(
  pkg: PackageData,
  scores: NpmsScores | null,
  security: SecuritySignals | null,
  trend: DownloadTrend | null,
  github: GitHubData | null,
): HealthAssessment {
  // Convert to format expected by computeHealthAssessment
  const pkgDoc: PackageDocument = {
    id: pkg.name,
    name: pkg.name,
    version: pkg.version,
    description: pkg.description,
    keywords: pkg.keywords,
    author: pkg.author,
    license: pkg.license,
    homepage: pkg.homepage,
    repository: pkg.repository,
    downloads: pkg.downloads,
    updated: pkg.updated,
    created: pkg.created,
    hasTypes: pkg.hasTypes,
    typesPackage: pkg.typesPackage,
    isESM: pkg.isESM,
    isCJS: pkg.isCJS,
    dependencies: pkg.dependencies,
    maintainers: pkg.maintainers,
    nodeVersion: pkg.nodeVersion,
    deprecated: pkg.deprecated,
    deprecatedMessage: pkg.deprecatedMessage,
    vulnerabilities: pkg.vulnerabilities.total,
    vulnCritical: pkg.vulnerabilities.critical,
    vulnHigh: pkg.vulnerabilities.high,
    hasProvenance: pkg.hasProvenance,
    hasInstallScripts: pkg.hasInstallScripts,
    isStable: pkg.isStable,
    licenseType: pkg.licenseType,
    moduleFormat: pkg.moduleFormat,
    inferredCategory: pkg.category,
    stars: github?.stars,
    unpackedSize: pkg.unpackedSize,
  };

  return computeHealthAssessment(pkgDoc, scores, security, trend);
}

/**
 * Build the final health response
 */
function buildHealthResponse(
  pkg: PackageData,
  health: HealthAssessment,
  scores: NpmsScores | null,
  details: PackageDetails | null,
  security: SecuritySignals | null,
  trend: DownloadTrend | null,
  github: GitHubData | null,
  alternatives: PackageDocument[],
  replacement: ReplacementInfo | null,
  readme: string | undefined,
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

  // Format alternatives (downloads come from Typesense, may be stale - that's OK for suggestions)
  const formattedAlternatives = alternatives.map((alt) => ({
    name: alt.name,
    downloads: alt.downloads,
    stars: alt.stars,
    reason: alt.description?.slice(0, 100),
  }));

  // Generate recommendation
  const pkgForRec = {
    name: pkg.name,
    deprecated: pkg.deprecated,
    deprecatedMessage: pkg.deprecatedMessage,
  };
  const recommendation = generateRecommendation(
    pkgForRec as PackageDocument,
    health,
    formattedAlternatives,
    replacement || undefined,
  );

  return {
    name: pkg.name,
    version: pkg.version,
    description: pkg.description,
    category: pkg.category,
    readme,

    health,

    security: {
      vulnerabilities: pkg.vulnerabilities,
      supplyChain: {
        hasProvenance: pkg.hasProvenance,
        hasInstallScripts: pkg.hasInstallScripts,
        hasGitDeps: security?.hasGitDeps || false,
        hasHttpDeps: security?.hasHttpDeps || false,
        maintainersCount: details?.maintainersCount || pkg.maintainers.length,
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
      isStable: pkg.isStable,
      scores: scores || undefined,
    },

    compatibility: {
      types: typesStatus,
      typesPackage: pkg.typesPackage,
      moduleFormat: pkg.moduleFormat,
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
      percentChange: trend?.percentChange,
      stars: github?.stars,
    },

    activity: {
      lastUpdated: new Date(pkg.updated).toISOString(),
      lastReleaseAge: daysSinceUpdate,
      maintainersCount: details?.maintainersCount || pkg.maintainers.length,
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
      pkg.hasBin && pkg.binCommands?.length
        ? {
            isCLI: true,
            commands: pkg.binCommands,
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
