/**
 * Package Schemas
 *
 * Zod schemas for package-related API responses.
 */

import { z } from "zod";

// =============================================================================
// Package Version
// =============================================================================

export const PackageVersionResponseSchema = z.object({
  name: z.string(),
  version: z.string(),
  publishedAt: z.string().nullable(),
});

// =============================================================================
// Check Deprecated
// =============================================================================

export const CheckDeprecatedResponseSchema = z.object({
  name: z.string(),
  version: z.string(),
  deprecated: z.boolean(),
  deprecationMessage: z.string().nullable(),
  maintenanceMode: z.boolean(),
  alternatives: z.array(z.string()).nullable(),
  recommended: z.string().nullable(),
  reason: z.string().nullable(),
  hasNativeReplacement: z.boolean().optional(),
  nativeReplacementInfo: z.string().optional(),
});

// =============================================================================
// Check Types
// =============================================================================

export const CheckTypesResponseSchema = z.object({
  name: z.string(),
  version: z.string(),
  hasTypes: z.boolean(),
  typesPackage: z.string().nullable(),
  source: z.enum(["bundled", "definitely-typed", "none"]),
});

// =============================================================================
// Vulnerabilities
// =============================================================================

export const VulnerabilityDataSchema = z.object({
  total: z.number(),
  critical: z.number(),
  high: z.number(),
  moderate: z.number(),
  low: z.number(),
});

export const CheckVulnerabilitiesResponseSchema = z.object({
  name: z.string(),
  version: z.string(),
  vulnerabilities: VulnerabilityDataSchema,
  hasVulnerabilities: z.boolean(),
  severity: z.enum(["none", "low", "moderate", "high", "critical"]),
});

// =============================================================================
// Find Alternatives
// =============================================================================

export const FindAlternativesResponseSchema = z.object({
  name: z.string(),
  category: z.string().nullable(),
  categoryName: z.string().nullable(),
  alternatives: z.array(z.string()),
  recommended: z.string().nullable(),
  reason: z.string().nullable(),
  hasComparison: z.boolean(),
});

// =============================================================================
// Weekly Downloads
// =============================================================================

export const WeeklyDataPointSchema = z.object({
  start: z.string(),
  end: z.string(),
  downloads: z.number(),
});

export const WeeklyDownloadsResponseSchema = z.object({
  package: z.string(),
  start: z.string(),
  end: z.string(),
  total: z.number(),
  weeks: z.array(WeeklyDataPointSchema),
});

// =============================================================================
// Install Size
// =============================================================================

export const InstallSizeResponseSchema = z.object({
  selfSize: z.number().describe("Unpacked size of the package itself (bytes)"),
  totalSize: z.number().describe("Total unpacked size including all dependencies (bytes)"),
  dependencyCount: z.number().describe("Number of transitive dependencies"),
});

// =============================================================================
// Health Assessment
// =============================================================================

export const HealthAssessmentSchema = z.object({
  score: z.number(),
  grade: z.enum(["A", "B", "C", "D", "F"]),
  status: z.enum(["active", "stable", "maintenance-mode", "deprecated", "abandoned"]),
  signals: z.object({
    positive: z.array(z.string()),
    negative: z.array(z.string()),
    warnings: z.array(z.string()),
  }),
});

export const NpmsScoresSchema = z.object({
  final: z.number(),
  quality: z.number(),
  popularity: z.number(),
  maintenance: z.number(),
});

export const GitHubDataSchema = z.object({
  stars: z.number().optional(),
  forks: z.number().optional(),
  openIssues: z.number().optional(),
  openPrs: z.number().optional(),
  lastCommit: z.string().optional(),
  license: z.string().optional(),
  description: z.string().optional(),
});

export const ReplacementInfoSchema = z.object({
  type: z.enum(["native", "documented", "simple", "none"]),
  replacement: z.string().optional(),
  reason: z.string().optional(),
  url: z.string().optional(),
});

export const PackageHealthResponseSchema = z.object({
  name: z.string(),
  version: z.string(),
  description: z.string().optional(),
  category: z.string().optional(),
  readme: z.string().optional(),

  health: HealthAssessmentSchema,

  security: z.object({
    vulnerabilities: z.object({
      total: z.number(),
      critical: z.number(),
      high: z.number(),
      moderate: z.number(),
      low: z.number(),
    }),
    supplyChain: z.object({
      hasProvenance: z.boolean(),
      hasInstallScripts: z.boolean(),
      hasGitDeps: z.boolean(),
      hasHttpDeps: z.boolean(),
      maintainersCount: z.number(),
    }),
    license: z.object({
      spdx: z.string().optional(),
      type: z.string().optional(),
      risk: z.enum(["low", "medium", "high", "unknown"]),
    }),
  }),

  quality: z.object({
    hasReadme: z.boolean(),
    readmeSize: z.number(),
    hasTests: z.boolean(),
    hasTestScript: z.boolean(),
    isStable: z.boolean(),
    scores: NpmsScoresSchema.optional(),
  }),

  compatibility: z.object({
    types: z.enum(["built-in", "@types", "none"]),
    typesPackage: z.string().optional(),
    moduleFormat: z.string().optional(),
    sideEffects: z.boolean().optional(),
    engines: z
      .object({
        node: z.string().optional(),
        npm: z.string().optional(),
      })
      .optional(),
    os: z.array(z.string()).optional(),
    cpu: z.array(z.string()).optional(),
  }),

  size: z.object({
    unpackedSize: z.number().optional(),
    unpackedSizeHuman: z.string().optional(),
    fileCount: z.number().optional(),
    dependencies: z.number(),
  }),

  popularity: z.object({
    weeklyDownloads: z.number(),
    downloadTrend: z.string().optional(),
    percentChange: z.number().optional(),
    stars: z.number().optional(),
  }),

  activity: z.object({
    lastUpdated: z.string(),
    lastReleaseAge: z.number(),
    maintainersCount: z.number(),
  }),

  github: GitHubDataSchema.optional(),

  author: z
    .object({
      name: z.string().optional(),
      github: z.string().optional(),
    })
    .optional(),

  funding: z
    .object({
      url: z.string().optional(),
      platforms: z.array(z.string()),
    })
    .optional(),

  cli: z
    .object({
      isCLI: z.boolean(),
      commands: z.array(z.string()),
    })
    .optional(),

  links: z.object({
    npm: z.string(),
    homepage: z.string().optional(),
    repository: z.string().optional(),
    bugs: z.string().optional(),
  }),

  replacement: ReplacementInfoSchema.optional(),

  alternatives: z.array(
    z.object({
      name: z.string(),
      downloads: z.number(),
      stars: z.number().optional(),
      healthScore: z.number().optional(),
      reason: z.string().optional(),
    }),
  ),

  recommendation: z.string(),
});

// Type exports
export type PackageVersionResponse = z.infer<typeof PackageVersionResponseSchema>;
export type CheckDeprecatedResponse = z.infer<typeof CheckDeprecatedResponseSchema>;
export type CheckTypesResponse = z.infer<typeof CheckTypesResponseSchema>;
export type CheckVulnerabilitiesResponse = z.infer<typeof CheckVulnerabilitiesResponseSchema>;
export type FindAlternativesResponse = z.infer<typeof FindAlternativesResponseSchema>;
export type WeeklyDownloadsResponse = z.infer<typeof WeeklyDownloadsResponseSchema>;
export type InstallSizeResponse = z.infer<typeof InstallSizeResponseSchema>;
export type PackageHealthResponse = z.infer<typeof PackageHealthResponseSchema>;
