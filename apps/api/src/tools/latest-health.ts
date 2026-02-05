/**
 * get_latest_with_health - Always get latest version with comprehensive health check
 *
 * Returns the latest version of a package with full health analysis,
 * security status, and safety assessment.
 */

import { fetchVulnerabilities } from "@packrun/data/osv";
import { z } from "zod";
import { getPackageHealth } from "./health";
import { getPackageVersion } from "./version";

export const getLatestWithHealthSchema = z.object({
  name: z.string().describe("The npm package name"),
  includeAlternatives: z
    .boolean()
    .optional()
    .default(false)
    .describe("Include alternative package recommendations"),
});

export type GetLatestWithHealthInput = z.infer<typeof getLatestWithHealthSchema>;

export interface GetLatestWithHealthResult {
  package: {
    name: string;
    latestVersion: string;
    publishedAt: string | null;
  };
  health: {
    score: number;
    grade: string;
    status: string;
  };
  security: {
    vulnerabilities: {
      total: number;
      critical: number;
      high: number;
      moderate: number;
      low: number;
    };
    isSafeToUse: boolean;
    securityNote: string;
  };
  maintenance: {
    lastUpdated: string;
    lastReleaseAge: number;
    maintainersCount: number;
    isWellMaintained: boolean;
  };
  upgradeUrgency: "none" | "low" | "medium" | "high" | "critical";
  recommendation: {
    safeToUse: boolean;
    reasoning: string;
    action: string;
  };
  alternatives?: Array<{
    name: string;
    version: string;
    healthScore: number;
    reason: string;
  }>;
}

export async function getLatestWithHealth(
  input: GetLatestWithHealthInput,
): Promise<GetLatestWithHealthResult> {
  // Get latest version
  const versionInfo = await getPackageVersion({ name: input.name });
  const latestVersion = versionInfo.version;

  // Get comprehensive health data
  const health = await getPackageHealth(input.name);
  if (!health) {
    throw new Error(`Package '${input.name}' not found`);
  }

  // Get vulnerabilities for latest version
  const vulns = await fetchVulnerabilities(input.name, latestVersion);

  // Determine if safe to use
  const isSafeToUse = vulns.critical === 0 && vulns.high === 0;
  let securityNote = "";
  if (vulns.critical > 0) {
    securityNote = `CRITICAL: ${vulns.critical} critical vulnerability/vulnerabilities found. Do not use this version.`;
  } else if (vulns.high > 0) {
    securityNote = `WARNING: ${vulns.high} high severity vulnerability/vulnerabilities found. Use with caution.`;
  } else if (vulns.total > 0) {
    securityNote = `${vulns.total} moderate/low severity vulnerability/vulnerabilities found.`;
  } else {
    securityNote = "No known security vulnerabilities.";
  }

  // Determine maintenance status
  const daysSinceUpdate = health.activity.lastReleaseAge;
  const isWellMaintained = daysSinceUpdate < 180; // Less than 6 months

  // Determine upgrade urgency
  let upgradeUrgency: "none" | "low" | "medium" | "high" | "critical" = "none";
  if (vulns.critical > 0) {
    upgradeUrgency = "critical";
  } else if (vulns.high > 0) {
    upgradeUrgency = "high";
  } else if (health.health.status === "deprecated") {
    upgradeUrgency = "high";
  } else if (health.health.status === "abandoned" || daysSinceUpdate > 365) {
    upgradeUrgency = "medium";
  } else if (health.health.score < 50) {
    upgradeUrgency = "low";
  }

  // Build recommendation
  let safeToUse = isSafeToUse && health.health.status !== "deprecated";
  let reasoning = "";
  let action = "";

  if (health.health.status === "deprecated") {
    safeToUse = false;
    reasoning = "Package is deprecated and should not be used in new projects.";
    action = health.replacement?.replacement
      ? `Use ${health.replacement.replacement} instead.`
      : "Find an alternative package.";
  } else if (vulns.critical > 0) {
    safeToUse = false;
    reasoning = securityNote;
    action = "Do not use this version. Check for security updates or find an alternative.";
  } else if (vulns.high > 0) {
    safeToUse = false;
    reasoning = securityNote;
    action = "Use with caution. Consider finding an alternative or waiting for security patches.";
  } else if (health.health.score >= 80) {
    reasoning = `Excellent health score (${health.health.score}/100). Well-maintained package with good security.`;
    action = "Safe to use. This is a high-quality package.";
  } else if (health.health.score >= 60) {
    reasoning = `Good health score (${health.health.score}/100). Package is maintained and generally safe.`;
    action = "Safe to use. Monitor for updates.";
  } else if (health.health.score >= 40) {
    reasoning = `Moderate health score (${health.health.score}/100). Package may have some concerns.`;
    action = "Use with caution. Consider alternatives if available.";
  } else {
    reasoning = `Low health score (${health.health.score}/100). Package has significant concerns.`;
    action = "Not recommended. Look for alternatives.";
    safeToUse = false;
  }

  // Get alternatives if requested
  let alternatives;
  if (input.includeAlternatives && health.alternatives.length > 0) {
    alternatives = health.alternatives.slice(0, 5).map((alt) => ({
      name: alt.name,
      version: "latest", // Would need to fetch actual latest version
      healthScore: alt.healthScore || 0,
      reason: alt.reason || "Alternative package",
    }));
  }

  return {
    package: {
      name: input.name,
      latestVersion,
      publishedAt: versionInfo.publishedAt,
    },
    health: {
      score: health.health.score,
      grade: health.health.grade,
      status: health.health.status,
    },
    security: {
      vulnerabilities: {
        total: vulns.total,
        critical: vulns.critical,
        high: vulns.high,
        moderate: vulns.moderate,
        low: vulns.low,
      },
      isSafeToUse,
      securityNote,
    },
    maintenance: {
      lastUpdated: health.activity.lastUpdated,
      lastReleaseAge: daysSinceUpdate,
      maintainersCount: health.activity.maintainersCount,
      isWellMaintained,
    },
    upgradeUrgency,
    recommendation: {
      safeToUse,
      reasoning,
      action,
    },
    alternatives,
  };
}
