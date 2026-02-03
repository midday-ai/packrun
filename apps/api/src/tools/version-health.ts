/**
 * check_version_health - Check if a specific package version is latest, secure, and well-maintained
 *
 * Compares a specific version against the latest version and provides
 * health analysis, security comparison, and upgrade recommendations.
 */

import { z } from "zod";
import { getPackageHealth } from "./health";
import { getPackage, getLatestVersion } from "../lib/clients/npm";
import { fetchVulnerabilities } from "../lib/clients/osv";

export const checkVersionHealthSchema = z.object({
  name: z.string().describe("The npm package name"),
  version: z
    .string()
    .optional()
    .describe("Current version to check (if not provided, checks latest version)"),
  checkLatest: z
    .boolean()
    .optional()
    .default(true)
    .describe("Whether to compare against latest version"),
});

export type CheckVersionHealthInput = z.infer<typeof checkVersionHealthSchema>;

export interface VersionComparison {
  currentVersion: string;
  latestVersion: string;
  isOutdated: boolean;
  versionDifference: "major" | "minor" | "patch" | "none";
  versionsBehind: number;
}

export interface SecurityComparison {
  currentVulnerabilities: number;
  latestVulnerabilities: number;
  vulnerabilitiesFixed: number;
  vulnerabilitiesIntroduced: number;
  severity: "none" | "low" | "moderate" | "high" | "critical";
}

export interface HealthComparison {
  currentHealthScore?: number;
  latestHealthScore?: number;
  healthScoreChange: number;
}

export interface CheckVersionHealthResult {
  package: {
    name: string;
    currentVersion: string;
    latestVersion: string;
  };
  comparison: VersionComparison;
  security: SecurityComparison;
  health: HealthComparison;
  isOutdated: boolean;
  upgradeUrgency: "none" | "low" | "medium" | "high" | "critical";
  upgradeRecommendation: {
    shouldUpgrade: boolean;
    reason: string;
    priority: string;
  };
  breakingChanges?: {
    hasBreakingChanges: boolean;
    note: string;
  };
}

/**
 * Compare two semver versions and determine difference type
 */
function compareVersions(
  current: string,
  latest: string,
): {
  difference: "major" | "minor" | "patch" | "none";
  behind: number;
} {
  // Remove any prefixes like ^, ~, >=
  const cleanCurrent = current.replace(/^[^0-9]+/, "");
  const cleanLatest = latest.replace(/^[^0-9]+/, "");

  const currentParts = cleanCurrent.split(".").map(Number);
  const latestParts = cleanLatest.split(".").map(Number);

  // Pad with zeros if needed
  while (currentParts.length < 3) currentParts.push(0);
  while (latestParts.length < 3) latestParts.push(0);

  const [currMajor = 0, currMinor = 0, currPatch = 0] = currentParts;
  const [latestMajor = 0, latestMinor = 0, latestPatch = 0] = latestParts;

  if (currMajor === latestMajor && currMinor === latestMinor && currPatch === latestPatch) {
    return { difference: "none", behind: 0 };
  }

  if (currMajor < latestMajor) {
    return { difference: "major", behind: latestMajor - currMajor };
  }

  if (currMinor < latestMinor) {
    return { difference: "minor", behind: latestMinor - currMinor };
  }

  if (currPatch < latestPatch) {
    return { difference: "patch", behind: latestPatch - currPatch };
  }

  return { difference: "none", behind: 0 };
}

export async function checkVersionHealth(
  input: CheckVersionHealthInput,
): Promise<CheckVersionHealthResult> {
  // Get package metadata
  const pkg = await getPackage(input.name);
  if (!pkg) {
    throw new Error(`Package '${input.name}' not found`);
  }

  const latestVersion = getLatestVersion(pkg);
  const currentVersion = input.version || latestVersion;

  // Get health data for both versions (we'll use latest for both since we don't have historical health)
  const latestHealth = await getPackageHealth(input.name);
  if (!latestHealth) {
    throw new Error(`Could not fetch health data for '${input.name}'`);
  }

  // Get vulnerabilities for both versions
  const [currentVulns, latestVulns] = await Promise.all([
    fetchVulnerabilities(input.name, currentVersion),
    fetchVulnerabilities(input.name, latestVersion),
  ]);

  // Compare versions
  const versionComparison = compareVersions(currentVersion, latestVersion);
  const isOutdated = versionComparison.difference !== "none";

  // Security comparison
  const vulnerabilitiesFixed = Math.max(0, currentVulns.total - latestVulns.total);
  const vulnerabilitiesIntroduced = Math.max(0, latestVulns.total - currentVulns.total);

  let severity: "none" | "low" | "moderate" | "high" | "critical" = "none";
  if (currentVulns.critical > 0 || latestVulns.critical > 0) severity = "critical";
  else if (currentVulns.high > 0 || latestVulns.high > 0) severity = "high";
  else if (currentVulns.moderate > 0 || latestVulns.moderate > 0) severity = "moderate";
  else if (currentVulns.low > 0 || latestVulns.low > 0) severity = "low";

  // Health comparison (using latest health score for both since we don't have historical)
  const healthScoreChange = 0; // Would need historical data to calculate

  // Determine upgrade urgency
  let upgradeUrgency: "none" | "low" | "medium" | "high" | "critical" = "none";
  let shouldUpgrade = false;
  let reason = "";
  let priority = "";

  if (!isOutdated) {
    reason = "You are using the latest version";
    priority = "No action needed";
  } else {
    shouldUpgrade = true;

    if (currentVulns.critical > 0 || latestVulns.critical > 0) {
      upgradeUrgency = "critical";
      reason = `Critical security vulnerabilities detected. Current version has ${currentVulns.critical} critical vulnerabilities.`;
      priority = "Upgrade immediately";
    } else if (currentVulns.high > 0) {
      upgradeUrgency = "high";
      reason = `High severity vulnerabilities detected. Current version has ${currentVulns.high} high severity vulnerabilities.`;
      priority = "Upgrade soon";
    } else if (versionComparison.difference === "major") {
      upgradeUrgency = "medium";
      reason = `Major version update available (${versionComparison.behind} major version${versionComparison.behind > 1 ? "s" : ""} behind). May include breaking changes.`;
      priority = "Review and upgrade";
    } else if (versionComparison.difference === "minor") {
      upgradeUrgency = "low";
      reason = `Minor version update available (${versionComparison.behind} minor version${versionComparison.behind > 1 ? "s" : ""} behind). Includes new features and bug fixes.`;
      priority = "Consider upgrading";
    } else {
      upgradeUrgency = "low";
      reason = `Patch version update available (${versionComparison.behind} patch version${versionComparison.behind > 1 ? "s" : ""} behind). Includes bug fixes.`;
      priority = "Consider upgrading";
    }

    if (vulnerabilitiesFixed > 0) {
      reason += ` Upgrading will fix ${vulnerabilitiesFixed} vulnerability/vulnerabilities.`;
    }
  }

  // Breaking changes note (major version updates likely have breaking changes)
  let breakingChanges;
  if (versionComparison.difference === "major" && isOutdated) {
    breakingChanges = {
      hasBreakingChanges: true,
      note: "Major version updates typically include breaking changes. Review the changelog before upgrading.",
    };
  }

  return {
    package: {
      name: input.name,
      currentVersion,
      latestVersion,
    },
    comparison: {
      currentVersion,
      latestVersion,
      isOutdated,
      versionDifference: versionComparison.difference,
      versionsBehind: versionComparison.behind,
    },
    security: {
      currentVulnerabilities: currentVulns.total,
      latestVulnerabilities: latestVulns.total,
      vulnerabilitiesFixed,
      vulnerabilitiesIntroduced,
      severity,
    },
    health: {
      currentHealthScore: latestHealth.health.score, // Using latest as proxy
      latestHealthScore: latestHealth.health.score,
      healthScoreChange,
    },
    isOutdated,
    upgradeUrgency,
    upgradeRecommendation: {
      shouldUpgrade,
      reason,
      priority,
    },
    breakingChanges,
  };
}
