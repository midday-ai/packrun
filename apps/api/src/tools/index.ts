/**
 * MCP Tools - Export all tools for the MCP server
 */

export {
  type FindAlternativesInput,
  type FindAlternativesResult,
  findAlternatives,
  findAlternativesSchema,
} from "./alternatives";
export {
  type SuggestLatestForCategoryInput,
  type SuggestLatestForCategoryResult,
  suggestLatestForCategory,
  suggestLatestForCategorySchema,
} from "./category-latest";
export {
  type ComparePackagesInput,
  type ComparePackagesResult,
  comparePackages,
  comparePackagesSchema,
} from "./compare";
export {
  type CheckDeprecatedInput,
  type CheckDeprecatedResult,
  checkDeprecated,
  checkDeprecatedSchema,
} from "./deprecated";
export {
  type GetLatestWithHealthInput,
  type GetLatestWithHealthResult,
  getLatestWithHealth,
  getLatestWithHealthSchema,
} from "./latest-health";
export {
  type AuditOutdatedPackagesInput,
  type AuditOutdatedPackagesResult,
  auditOutdatedPackages,
  auditOutdatedPackagesSchema,
} from "./outdated-audit";
export {
  type CheckTypesInput,
  type CheckTypesResult,
  checkTypes,
  checkTypesSchema,
} from "./types";
export {
  type GetPackageVersionInput,
  type GetPackageVersionResult,
  getPackageVersion,
  getPackageVersionSchema,
} from "./version";
export {
  type CheckVersionHealthInput,
  type CheckVersionHealthResult,
  checkVersionHealth,
  checkVersionHealthSchema,
} from "./version-health";
export {
  type CheckVulnerabilitiesInput,
  type CheckVulnerabilitiesResult,
  checkVulnerabilities,
  checkVulnerabilitiesSchema,
} from "./vulnerabilities";
