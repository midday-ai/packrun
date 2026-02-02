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
  type CheckVulnerabilitiesInput,
  type CheckVulnerabilitiesResult,
  checkVulnerabilities,
  checkVulnerabilitiesSchema,
} from "./vulnerabilities";
