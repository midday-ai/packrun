/**
 * Notification Enrichment
 *
 * Enriches package updates with:
 * - Version analysis (breaking changes, first stable)
 * - Security vulnerability information
 * - Changelog snippets from GitHub releases
 * - Severity classification
 */

import { fetchVulnerabilities } from "@packrun/data/osv";
import semver from "semver";

// =============================================================================
// Types
// =============================================================================

export interface VersionAnalysis {
  isBreakingChange: boolean;
  diffType:
    | "major"
    | "premajor"
    | "minor"
    | "preminor"
    | "patch"
    | "prepatch"
    | "prerelease"
    | null;
  isPrerelease: boolean;
  isFirstStable: boolean;
}

export interface SecurityAnalysis {
  isSecurityUpdate: boolean;
  vulnerabilitiesFixed: number;
  oldVulnCount: number;
  newVulnCount: number;
}

export interface NotificationEnrichment {
  versionAnalysis: VersionAnalysis;
  securityAnalysis: SecurityAnalysis;
  changelogSnippet: string | null;
  severity: "critical" | "important" | "info";
}

// =============================================================================
// Version Analysis
// =============================================================================

/**
 * Analyze version change using semver
 */
export function analyzeVersionChange(
  oldVersion: string | null | undefined,
  newVersion: string,
): VersionAnalysis {
  const cleanNew = semver.clean(newVersion) || newVersion;
  const cleanOld = oldVersion ? semver.clean(oldVersion) || oldVersion : null;

  // Default result for new packages
  if (!cleanOld) {
    return {
      isBreakingChange: false,
      diffType: null,
      isPrerelease: semver.prerelease(cleanNew) !== null,
      isFirstStable: false,
    };
  }

  // Get diff type: 'major', 'minor', 'patch', 'prerelease', etc.
  const diffType = semver.diff(cleanOld, cleanNew) as VersionAnalysis["diffType"];

  // Major version bump = breaking change
  const isBreakingChange = diffType === "major" || diffType === "premajor";

  // Check if this is a prerelease (alpha, beta, rc)
  const isPrerelease = semver.prerelease(cleanNew) !== null;

  // Special case: 0.x → 1.x is significant (first stable release)
  let isFirstStable = false;
  try {
    const oldMajor = semver.major(cleanOld);
    const newMajor = semver.major(cleanNew);
    isFirstStable = oldMajor === 0 && newMajor === 1;
  } catch {
    // Invalid semver, ignore
  }

  return { isBreakingChange, diffType, isPrerelease, isFirstStable };
}

// =============================================================================
// Security Analysis
// =============================================================================

/**
 * Check if the update fixes security vulnerabilities
 */
export async function analyzeSecurityUpdate(
  packageName: string,
  oldVersion: string | null | undefined,
  newVersion: string,
): Promise<SecurityAnalysis> {
  const defaultResult: SecurityAnalysis = {
    isSecurityUpdate: false,
    vulnerabilitiesFixed: 0,
    oldVulnCount: 0,
    newVulnCount: 0,
  };

  // Can't compare without old version
  if (!oldVersion) {
    return defaultResult;
  }

  try {
    // Fetch vulnerabilities for both versions
    const [oldVulns, newVulns] = await Promise.all([
      fetchVulnerabilities(packageName, oldVersion).catch(() => ({ total: 0 })),
      fetchVulnerabilities(packageName, newVersion).catch(() => ({ total: 0 })),
    ]);

    const oldTotal = oldVulns.total || 0;
    const newTotal = newVulns.total || 0;
    const fixedCount = Math.max(0, oldTotal - newTotal);

    return {
      isSecurityUpdate: fixedCount > 0,
      vulnerabilitiesFixed: fixedCount,
      oldVulnCount: oldTotal,
      newVulnCount: newTotal,
    };
  } catch (error) {
    console.error(`[Enrichment] Error checking security for ${packageName}:`, error);
    return defaultResult;
  }
}

// =============================================================================
// Changelog Fetching
// =============================================================================

/**
 * Fetch changelog snippet from GitHub releases
 */
export async function fetchChangelogSnippet(
  repositoryUrl: string | { url?: string } | undefined,
  version: string,
): Promise<string | null> {
  if (!repositoryUrl) return null;

  // Handle repository as object (npm metadata can have { type, url })
  const url = typeof repositoryUrl === "string" ? repositoryUrl : repositoryUrl.url;
  if (!url) return null;

  // Extract owner/repo from URL
  const match = url.match(/github\.com\/([^/]+)\/([^/]+)/);
  if (!match) return null;

  const [, owner, repo] = match;
  const cleanRepo = repo?.replace(/\.git$/, "");

  if (!owner || !cleanRepo) return null;

  try {
    // Try different tag formats
    const tagVariants = [`v${version}`, version, `${cleanRepo}@${version}`];

    for (const tag of tagVariants) {
      const url = `https://api.github.com/repos/${owner}/${cleanRepo}/releases/tags/${tag}`;
      const response = await fetch(url, {
        headers: {
          Accept: "application/vnd.github.v3+json",
          "User-Agent": "packrun.dev-worker",
          ...(process.env.GITHUB_TOKEN && {
            Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
          }),
        },
      });

      if (response.ok) {
        const data = await response.json();
        const body = data.body as string | undefined;

        if (body) {
          // Strip markdown and truncate
          const plainText = body
            .replace(/```[\s\S]*?```/g, "") // Remove code blocks
            .replace(/#{1,6}\s+/g, "") // Remove headers
            .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // Convert links to text
            .replace(/[*_~`]/g, "") // Remove formatting
            .replace(/\n{3,}/g, "\n\n") // Normalize newlines
            .trim();

          // Return first ~300 chars
          if (plainText.length > 300) {
            return plainText.slice(0, 297) + "...";
          }
          return plainText || null;
        }
      }
    }

    return null;
  } catch (error) {
    console.error(`[Enrichment] Error fetching changelog for ${repositoryUrl}:`, error);
    return null;
  }
}

// =============================================================================
// Severity Classification
// =============================================================================

/**
 * Classify notification severity based on enrichment data
 */
export function classifySeverity(
  versionAnalysis: VersionAnalysis,
  securityAnalysis: SecurityAnalysis,
): "critical" | "important" | "info" {
  // Critical: Security fixes
  if (securityAnalysis.isSecurityUpdate && securityAnalysis.vulnerabilitiesFixed > 0) {
    return "critical";
  }

  // Important: Breaking changes or first stable release
  if (versionAnalysis.isBreakingChange || versionAnalysis.isFirstStable) {
    return "important";
  }

  // Info: Minor, patch, prerelease
  return "info";
}

// =============================================================================
// Main Enrichment Function
// =============================================================================

/**
 * Enrich a package update with all available information
 */
export async function enrichPackageUpdate(
  packageName: string,
  oldVersion: string | null | undefined,
  newVersion: string,
  repositoryUrl: string | { url?: string } | undefined,
): Promise<NotificationEnrichment> {
  // Run analyses in parallel
  const [versionAnalysis, securityAnalysis, changelogSnippet] = await Promise.all([
    Promise.resolve(analyzeVersionChange(oldVersion, newVersion)),
    analyzeSecurityUpdate(packageName, oldVersion, newVersion),
    fetchChangelogSnippet(repositoryUrl, newVersion),
  ]);

  const severity = classifySeverity(versionAnalysis, securityAnalysis);

  return {
    versionAnalysis,
    securityAnalysis,
    changelogSnippet,
    severity,
  };
}
