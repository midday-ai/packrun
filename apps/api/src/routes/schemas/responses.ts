/**
 * OpenAPI Response Schemas
 *
 * Zod schemas for all API responses with OpenAPI metadata.
 */

import { z } from "@hono/zod-openapi";

// =============================================================================
// Common Schemas
// =============================================================================

export const ErrorResponseSchema = z
  .object({
    error: z.string(),
  })
  .openapi("ErrorResponse");

export const SuccessResponseSchema = z
  .object({
    success: z.boolean(),
  })
  .openapi("SuccessResponse");

export const MessageResponseSchema = z
  .object({
    message: z.string(),
  })
  .openapi("MessageResponse");

// =============================================================================
// Health Check
// =============================================================================

export const HealthCheckResponseSchema = z
  .object({
    status: z.string(),
    timestamp: z.string(),
    service: z.string(),
  })
  .openapi("HealthCheckResponse");

// =============================================================================
// Package Version
// =============================================================================

export const PackageVersionResponseSchema = z
  .object({
    name: z.string(),
    version: z.string(),
    publishedAt: z.string().nullable(),
  })
  .openapi("PackageVersionResponse");

// =============================================================================
// Check Deprecated
// =============================================================================

export const CheckDeprecatedResponseSchema = z
  .object({
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
  })
  .openapi("CheckDeprecatedResponse");

// =============================================================================
// Check Types
// =============================================================================

export const CheckTypesResponseSchema = z
  .object({
    name: z.string(),
    version: z.string(),
    hasTypes: z.boolean(),
    typesPackage: z.string().nullable(),
    source: z.enum(["bundled", "definitely-typed", "none"]),
  })
  .openapi("CheckTypesResponse");

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

export const CheckVulnerabilitiesResponseSchema = z
  .object({
    name: z.string(),
    version: z.string(),
    vulnerabilities: VulnerabilityDataSchema,
    hasVulnerabilities: z.boolean(),
    severity: z.enum(["none", "low", "moderate", "high", "critical"]),
  })
  .openapi("CheckVulnerabilitiesResponse");

// =============================================================================
// Find Alternatives
// =============================================================================

export const FindAlternativesResponseSchema = z
  .object({
    name: z.string(),
    category: z.string().nullable(),
    categoryName: z.string().nullable(),
    alternatives: z.array(z.string()),
    recommended: z.string().nullable(),
    reason: z.string().nullable(),
    hasComparison: z.boolean(),
  })
  .openapi("FindAlternativesResponse");

// =============================================================================
// Compare Packages
// =============================================================================

export const PackageComparisonDataSchema = z.object({
  name: z.string(),
  version: z.string(),
  weeklyDownloads: z.number(),
  hasTypes: z.boolean(),
  isESM: z.boolean(),
  isCJS: z.boolean(),
  vulnerabilities: z.number(),
});

export const ComparePackagesResponseSchema = z
  .object({
    packages: z.array(PackageComparisonDataSchema),
    curatedComparison: z
      .object({
        category: z.string(),
        categoryName: z.string(),
        recommendation: z.string(),
        reasoning: z.string(),
        comparison: z.record(z.string(), z.record(z.string(), z.unknown()).optional()),
      })
      .nullable(),
  })
  .openapi("ComparePackagesResponse");

// =============================================================================
// Weekly Downloads
// =============================================================================

export const WeeklyDataPointSchema = z.object({
  start: z.string(),
  end: z.string(),
  downloads: z.number(),
});

export const WeeklyDownloadsResponseSchema = z
  .object({
    package: z.string(),
    start: z.string(),
    end: z.string(),
    total: z.number(),
    weeks: z.array(WeeklyDataPointSchema),
  })
  .openapi("WeeklyDownloadsResponse");

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

export const PackageHealthResponseSchema = z
  .object({
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
  })
  .openapi("PackageHealthResponse");

// =============================================================================
// Search
// =============================================================================

export const SearchHitSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  version: z.string(),
  downloads: z.number().optional(),
  hasTypes: z.boolean().optional(),
  license: z.string().optional(),
  deprecated: z.boolean().optional(),
  deprecatedMessage: z.string().optional(),
  author: z.string().optional(),
  homepage: z.string().optional(),
  repository: z.string().optional(),
  keywords: z.array(z.string()).optional(),
  stars: z.number().optional(),
  isESM: z.boolean().optional(),
  isCJS: z.boolean().optional(),
  dependencies: z.number().optional(),
  maintainers: z.array(z.string()).optional(),
  created: z.number().optional(),
  updated: z.number().optional(),
  vulnerabilities: z.number().optional(),
  funding: z.string().optional(),
});

export const SearchResponseSchema = z
  .object({
    hits: z.array(SearchHitSchema),
    found: z.number(),
    page: z.number(),
  })
  .openapi("SearchResponse");

// =============================================================================
// Favorites
// =============================================================================

export const FavoritesListResponseSchema = z
  .object({
    favorites: z.array(z.string()),
  })
  .openapi("FavoritesListResponse");

export const FavoriteActionResponseSchema = z
  .object({
    success: z.boolean(),
    packageName: z.string(),
  })
  .openapi("FavoriteActionResponse");

export const FavoriteCheckResponseSchema = z
  .object({
    isFavorite: z.boolean(),
  })
  .openapi("FavoriteCheckResponse");

// =============================================================================
// Compare API (complex)
// =============================================================================

export const CategoryInfoSchema = z.object({
  id: z.string(),
  name: z.string(),
  keywords: z.array(z.string()),
  source: z.string(),
  confidence: z.number(),
});

export const CategoriesListResponseSchema = z
  .object({
    categories: z.array(CategoryInfoSchema),
    curatedCount: z.number(),
    seedCategories: z.number(),
    discoveredCategories: z.number(),
    totalCategories: z.number(),
  })
  .openapi("CategoriesListResponse");

export const PackageAlternativeSchema = z.object({
  name: z.string(),
  score: z.number().optional(),
  badges: z.array(z.string()).optional(),
});

export const PackageAlternativesResponseSchema = z
  .object({
    package: z.string(),
    category: z.string().nullable(),
    categoryName: z.string().optional(),
    alternatives: z.array(PackageAlternativeSchema),
    comparison: z.unknown().optional(),
    message: z.string().optional(),
  })
  .openapi("PackageAlternativesResponse");

export const ComparisonPackageSchema = z.object({
  name: z.string(),
  score: z.number(),
  badges: z.array(z.string()),
  version: z.string().optional(),
  weeklyDownloads: z.number().optional(),
  stars: z.number().optional(),
  hasTypes: z.boolean().optional(),
  isESM: z.boolean().optional(),
  lastUpdated: z.string().optional(),
  license: z.string().optional(),
});

export const ComparisonResponseSchema = z
  .object({
    category: z.string(),
    categoryName: z.string(),
    packages: z.array(ComparisonPackageSchema),
    winner: z.string().optional(),
    reasoning: z.string().optional(),
  })
  .openapi("ComparisonResponse");

export const CompareUsageResponseSchema = z
  .object({
    message: z.string(),
    usage: z.record(z.string(), z.string()),
    availableCategories: z.array(z.string()),
    seedCategories: z.number(),
    totalCategories: z.number(),
  })
  .openapi("CompareUsageResponse");
