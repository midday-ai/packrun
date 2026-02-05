/**
 * Health Score Computation
 *
 * Computes a 0-100 health score from various signals.
 */

import type { NpmsScores } from "@packrun/data/npms";
import type { PackageDocument } from "./clients/typesense";
import type { DownloadTrend, SecuritySignals } from "./enrichment";

export interface HealthAssessment {
  score: number;
  grade: "A" | "B" | "C" | "D" | "F";
  status: "active" | "stable" | "maintenance-mode" | "deprecated" | "abandoned";
  signals: {
    positive: string[];
    negative: string[];
    warnings: string[];
  };
}

/**
 * Compute health score and status from all signals
 */
export function computeHealthAssessment(
  pkg: PackageDocument,
  scores: NpmsScores | null,
  security: SecuritySignals | null,
  trend: DownloadTrend | null,
): HealthAssessment {
  const positive: string[] = [];
  const negative: string[] = [];
  const warnings: string[] = [];

  let score = 50; // Start at neutral

  // === Deprecation (immediate flags) ===
  if (pkg.deprecated) {
    return {
      score: 10,
      grade: "F",
      status: "deprecated",
      signals: {
        positive: [],
        negative: ["deprecated"],
        warnings: [],
      },
    };
  }

  // === Downloads (popularity) ===
  if (pkg.downloads > 10_000_000) {
    score += 15;
    positive.push("very-high-downloads");
  } else if (pkg.downloads > 1_000_000) {
    score += 10;
    positive.push("high-downloads");
  } else if (pkg.downloads > 100_000) {
    score += 5;
    positive.push("moderate-downloads");
  } else if (pkg.downloads < 1_000) {
    score -= 10;
    warnings.push("low-downloads");
  }

  // === Types ===
  if (pkg.hasTypes) {
    score += 5;
    positive.push("has-types");
  } else if (pkg.typesPackage) {
    score += 3;
    positive.push("has-types-package");
  } else {
    warnings.push("no-types");
  }

  // === ESM support ===
  if (pkg.isESM) {
    score += 5;
    positive.push("esm-support");
  } else if (pkg.moduleFormat === "dual") {
    score += 5;
    positive.push("dual-module-format");
  } else {
    warnings.push("no-esm-support");
  }

  // === Security ===
  if (pkg.vulnerabilities && pkg.vulnerabilities > 0) {
    if (pkg.vulnCritical && pkg.vulnCritical > 0) {
      score -= 25;
      negative.push("critical-vulnerabilities");
    } else if (pkg.vulnHigh && pkg.vulnHigh > 0) {
      score -= 15;
      negative.push("high-vulnerabilities");
    } else {
      score -= 5;
      warnings.push("has-vulnerabilities");
    }
  } else {
    score += 5;
    positive.push("no-vulnerabilities");
  }

  if (pkg.hasProvenance) {
    score += 5;
    positive.push("has-provenance");
  }

  if (security?.hasGitDeps || security?.hasHttpDeps) {
    score -= 10;
    negative.push("insecure-dependencies");
  }

  // === Maintenance ===
  const daysSinceUpdate = (Date.now() - pkg.updated) / (1000 * 60 * 60 * 24);

  if (daysSinceUpdate > 730) {
    // 2+ years
    score -= 20;
    negative.push("abandoned");
  } else if (daysSinceUpdate > 365) {
    // 1+ year
    score -= 10;
    negative.push("stale");
  } else if (daysSinceUpdate < 90) {
    score += 5;
    positive.push("recently-updated");
  }

  // === npms.io scores ===
  if (scores) {
    if (scores.maintenance < 0.3) {
      score -= 10;
      negative.push("low-maintenance-score");
    } else if (scores.maintenance > 0.7) {
      score += 5;
      positive.push("high-maintenance-score");
    }

    if (scores.quality > 0.8) {
      score += 5;
      positive.push("high-quality-score");
    } else if (scores.quality < 0.4) {
      // For extremely popular packages, don't penalize low quality scores
      // (npms.io quality metrics may not reflect true package health for foundational tools)
      const isExtremelyPopular = (pkg.stars && pkg.stars > 50_000) || pkg.downloads > 50_000_000;
      if (!isExtremelyPopular) {
        score -= 5;
        warnings.push("low-quality-score");
      } else {
        warnings.push("low-quality-score-ignored-extremely-popular");
      }
    }
  } else {
    // No npms data: infer quality/maintenance from stars + recency so strong packages can still reach 100
    // For very popular packages (>50k stars or >50M downloads), allow longer update windows
    const isVeryPopular = (pkg.stars && pkg.stars > 50_000) || pkg.downloads > 50_000_000;
    const updateWindow = isVeryPopular ? 180 : 90; // 6 months for very popular, 3 months otherwise

    if (
      pkg.stars &&
      pkg.stars > 10_000 &&
      daysSinceUpdate < updateWindow &&
      (!pkg.vulnerabilities || pkg.vulnerabilities === 0)
    ) {
      score += 5;
      positive.push("inferred-quality");
    } else if (isVeryPopular && (!pkg.vulnerabilities || pkg.vulnerabilities === 0)) {
      // Very popular packages get quality bonus even if not recently updated (they're stable)
      score += 5;
      positive.push("inferred-quality-very-popular");
    }
  }

  // === Trend ===
  if (trend) {
    if (trend.trend === "declining" && trend.percentChange < -30) {
      score -= 10;
      negative.push("declining-downloads");
    } else if (trend.trend === "growing" && trend.percentChange > 30) {
      score += 5;
      positive.push("growing-popularity");
    }
  } else {
    // No trend data: infer trend from popularity and health
    const isVeryPopular = (pkg.stars && pkg.stars > 50_000) || pkg.downloads > 50_000_000;

    if (
      pkg.downloads > 1_000_000 &&
      pkg.stars &&
      pkg.stars > 10_000 &&
      (!pkg.vulnerabilities || pkg.vulnerabilities === 0)
    ) {
      // Popular and healthy: bonus so top packages can reach 100
      score += 5;
      positive.push("inferred-trend");
    }
  }

  // === Size ===
  if (pkg.unpackedSize && pkg.unpackedSize > 10_000_000) {
    warnings.push("large-bundle");
  }

  // === Stability ===
  if (!pkg.isStable) {
    warnings.push("pre-1.0");
  }

  // === Stars ===
  if (pkg.stars && pkg.stars > 10000) {
    score += 5;
    positive.push("popular-repo");
  }

  // === Very Popular Packages Bonus ===
  // For extremely popular packages (>50k stars or >50M downloads), add bonus
  // to compensate for missing ESM/provenance/recent-update points
  // These packages are foundational and stable even if they don't update frequently
  const isExtremelyPopular = (pkg.stars && pkg.stars > 50_000) || pkg.downloads > 50_000_000;
  if (isExtremelyPopular && (!pkg.vulnerabilities || pkg.vulnerabilities === 0)) {
    // Add bonus for extremely popular, secure packages (TypeScript, React, etc.)
    // This helps them reach 100 even if missing ESM/provenance/recent-update points
    score += 5;
    positive.push("extremely-popular");
  }

  // Clamp score
  score = Math.max(0, Math.min(100, score));

  // Determine grade
  let grade: "A" | "B" | "C" | "D" | "F";
  if (score >= 80) grade = "A";
  else if (score >= 65) grade = "B";
  else if (score >= 50) grade = "C";
  else if (score >= 35) grade = "D";
  else grade = "F";

  // Determine status
  let status: "active" | "stable" | "maintenance-mode" | "deprecated" | "abandoned";
  if (daysSinceUpdate > 730) {
    status = "abandoned";
  } else if (scores && scores.maintenance < 0.3 && daysSinceUpdate > 365) {
    status = "maintenance-mode";
  } else if (daysSinceUpdate < 180 && scores && scores.maintenance > 0.5) {
    status = "active";
  } else {
    status = "stable";
  }

  return {
    score: Math.round(score),
    grade,
    status,
    signals: { positive, negative, warnings },
  };
}

/**
 * Generate AI-friendly recommendation text
 */
export function generateRecommendation(
  pkg: PackageDocument,
  health: HealthAssessment,
  alternatives: Array<{ name: string; downloads: number }>,
  replacementInfo?: { useInstead?: string; reason?: string },
): string {
  const parts: string[] = [];

  // Replacement recommendation
  if (replacementInfo?.useInstead) {
    parts.push(
      `Consider using ${replacementInfo.useInstead} instead. ${replacementInfo.reason || ""}`,
    );
  }

  // Status-based recommendation
  if (health.status === "deprecated") {
    parts.push(`${pkg.name} is deprecated and should not be used in new projects.`);
  } else if (health.status === "abandoned") {
    parts.push(
      `${pkg.name} appears to be abandoned (no updates in 2+ years). Consider alternatives.`,
    );
  } else if (health.status === "maintenance-mode") {
    parts.push(`${pkg.name} is in maintenance mode with limited updates.`);
  }

  // Security warnings
  if (health.signals.negative.includes("critical-vulnerabilities")) {
    parts.push("WARNING: This package has critical security vulnerabilities.");
  }

  // Alternatives suggestion
  if (alternatives.length > 0 && health.score < 60) {
    const altNames = alternatives.slice(0, 3).map((a) => a.name);
    parts.push(`Popular alternatives: ${altNames.join(", ")}.`);
  }

  // Positive aspects
  if (health.grade === "A" && parts.length === 0) {
    parts.push(`${pkg.name} is a healthy, well-maintained package.`);
  }

  return parts.join(" ").trim() || `${pkg.name} v${pkg.version} appears to be in good standing.`;
}
