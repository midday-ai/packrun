/**
 * audit_outdated_packages - Analyze package.json to find outdated packages
 *
 * Scans package.json dependencies and devDependencies to identify
 * outdated packages, security vulnerabilities, and prioritize upgrades.
 */

import { api as log } from "@packrun/logger";
import { z } from "zod";
import { getLatestWithHealth } from "./latest-health";
import { getPackageVersion } from "./version";
import { checkVersionHealth } from "./version-health";

export const auditOutdatedPackagesSchema = z.object({
  packageJson: z
    .string()
    .or(z.record(z.string(), z.unknown()))
    .describe("package.json content as string or parsed object"),
  includeDevDependencies: z
    .boolean()
    .optional()
    .default(false)
    .describe("Check devDependencies too"),
  minSeverity: z
    .enum(["low", "moderate", "high", "critical"])
    .optional()
    .default("low")
    .describe("Minimum severity to report"),
});

export type AuditOutdatedPackagesInput = z.infer<typeof auditOutdatedPackagesSchema>;

export interface OutdatedPackage {
  name: string;
  currentVersion: string;
  latestVersion: string;
  versionDifference: "major" | "minor" | "patch" | "none";
  isOutdated: boolean;
  healthScore?: number;
  vulnerabilities: {
    current: number;
    latest: number;
    fixed: number;
  };
  upgradePriority: "critical" | "high" | "medium" | "low";
  upgradeReason: string;
  breakingChanges?: boolean;
}

export interface AuditOutdatedPackagesResult {
  summary: {
    totalPackages: number;
    outdatedPackages: number;
    criticalIssues: number;
    highPriorityUpgrades: number;
    majorVersionUpdates: number;
    securityVulnerabilities: number;
  };
  outdated: OutdatedPackage[];
  recommendations: {
    immediate: string[];
    soon: string[];
    consider: string[];
  };
}

/**
 * Parse version range to extract base version
 */
function parseVersionRange(version: string): string {
  // Remove range prefixes: ^, ~, >=, <=, >, <
  const cleaned = version.replace(/^[\^~><=]+/, "").split(" ")[0];
  if (!cleaned) {
    throw new Error(`Invalid version range: ${version}`);
  }
  return cleaned;
}

/**
 * Determine upgrade priority
 */
function determinePriority(
  vulns: { current: number; latest: number; fixed: number },
  versionDiff: "major" | "minor" | "patch" | "none",
  isDeprecated: boolean,
): "critical" | "high" | "medium" | "low" {
  if (vulns.current > 0 && vulns.current >= 1) return "critical";
  if (isDeprecated) return "high";
  if (versionDiff === "major") return "medium";
  if (versionDiff === "minor" && vulns.fixed > 0) return "medium";
  if (versionDiff === "minor") return "low";
  if (versionDiff === "patch") return "low";
  return "low";
}

export async function auditOutdatedPackages(
  input: AuditOutdatedPackagesInput,
): Promise<AuditOutdatedPackagesResult> {
  // Parse package.json
  let pkgJson: Record<string, unknown>;
  if (typeof input.packageJson === "string") {
    try {
      pkgJson = JSON.parse(input.packageJson) as Record<string, unknown>;
    } catch {
      throw new Error("Invalid package.json format");
    }
  } else {
    pkgJson = input.packageJson as Record<string, unknown>;
  }

  const dependencies = (pkgJson.dependencies as Record<string, string>) || {};
  const devDependencies = input.includeDevDependencies
    ? (pkgJson.devDependencies as Record<string, string>) || {}
    : {};

  const allDeps = { ...dependencies, ...devDependencies };
  const packageNames = Object.keys(allDeps).filter((name) => allDeps[name]);

  // Audit each package
  const auditPromises = packageNames.map(async (name): Promise<OutdatedPackage | null> => {
    try {
      const currentVersionRange = allDeps[name];
      if (!currentVersionRange || typeof currentVersionRange !== "string") {
        return null;
      }
      const currentVersion = parseVersionRange(currentVersionRange);

      // Get latest version
      const latestInfo = await getPackageVersion({ name });
      const latestVersion = latestInfo.version;

      // Check version health
      const versionHealth = await checkVersionHealth({
        name,
        version: currentVersion,
        checkLatest: true,
      });

      // Get latest health for vulnerability info
      const latestHealth = await getLatestWithHealth({ name, includeAlternatives: false });

      const isOutdated = versionHealth.isOutdated;
      const versionDiff = versionHealth.comparison.versionDifference;

      const vulns = {
        current: versionHealth.security.currentVulnerabilities,
        latest: versionHealth.security.latestVulnerabilities,
        fixed: versionHealth.security.vulnerabilitiesFixed,
      };

      const isDeprecated = latestHealth.health.status === "deprecated";

      const upgradePriority = determinePriority(vulns, versionDiff, isDeprecated);

      // Build upgrade reason
      let upgradeReason = "";
      if (vulns.current > 0) {
        upgradeReason = `${vulns.current} security vulnerability/vulnerabilities (${vulns.fixed} fixed in latest)`;
      } else if (isDeprecated) {
        upgradeReason = "Package is deprecated";
      } else if (versionDiff === "major") {
        upgradeReason = `Major version update available (may include breaking changes)`;
      } else if (versionDiff === "minor") {
        upgradeReason = `Minor version update available (new features and improvements)`;
      } else if (versionDiff === "patch") {
        upgradeReason = `Patch version update available (bug fixes)`;
      } else {
        upgradeReason = "Up to date";
      }

      return {
        name,
        currentVersion,
        latestVersion,
        versionDifference: versionDiff,
        isOutdated,
        healthScore: latestHealth.health.score,
        vulnerabilities: vulns,
        upgradePriority,
        upgradeReason,
        breakingChanges: versionDiff === "major",
      };
    } catch (error) {
      // Package not found or error - skip it
      log.error(`Failed to audit ${name}:`, error);
      return null;
    }
  });

  const auditResults = (await Promise.all(auditPromises)).filter(
    (p): p is OutdatedPackage => p !== null,
  );

  // Filter by severity
  const severityMap = { low: 0, moderate: 1, high: 2, critical: 3 };
  const minSeverityLevel = severityMap[input.minSeverity];
  const filteredResults = auditResults.filter((pkg) => {
    if (pkg.vulnerabilities.current > 0) return true;
    if (pkg.upgradePriority === "critical" || pkg.upgradePriority === "high") return true;
    return pkg.isOutdated;
  });

  // Sort by priority
  const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  filteredResults.sort((a, b) => {
    return priorityOrder[a.upgradePriority] - priorityOrder[b.upgradePriority];
  });

  // Build summary
  const criticalIssues = filteredResults.filter(
    (p) => p.vulnerabilities.current > 0 || p.upgradePriority === "critical",
  ).length;
  const highPriority = filteredResults.filter((p) => p.upgradePriority === "high").length;
  const majorUpdates = filteredResults.filter((p) => p.versionDifference === "major").length;
  const totalVulns = filteredResults.reduce((sum, p) => sum + p.vulnerabilities.current, 0);

  // Build recommendations
  const immediate: string[] = [];
  const soon: string[] = [];
  const consider: string[] = [];

  for (const pkg of filteredResults) {
    if (pkg.vulnerabilities.current > 0 || pkg.upgradePriority === "critical") {
      immediate.push(`${pkg.name}: ${pkg.upgradeReason}`);
    } else if (pkg.upgradePriority === "high") {
      soon.push(`${pkg.name}: ${pkg.upgradeReason}`);
    } else if (pkg.isOutdated) {
      consider.push(`${pkg.name}: ${pkg.upgradeReason}`);
    }
  }

  return {
    summary: {
      totalPackages: packageNames.length,
      outdatedPackages: filteredResults.filter((p) => p.isOutdated).length,
      criticalIssues,
      highPriorityUpgrades: highPriority,
      majorVersionUpdates: majorUpdates,
      securityVulnerabilities: totalVulns,
    },
    outdated: filteredResults,
    recommendations: {
      immediate,
      soon,
      consider,
    },
  };
}
