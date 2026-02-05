/**
 * check_vulnerabilities - Check for security vulnerabilities in a package
 */

import { fetchVulnerabilities, type VulnerabilityData } from "@packrun/data/osv";
import { z } from "zod";
import { getLatestVersion, getPackage } from "../lib/clients/npm";

export const checkVulnerabilitiesSchema = z.object({
  name: z.string().describe("The npm package name"),
  version: z.string().optional().describe("Specific version to check (defaults to latest)"),
});

export type CheckVulnerabilitiesInput = z.infer<typeof checkVulnerabilitiesSchema>;

export interface CheckVulnerabilitiesResult {
  name: string;
  version: string;
  vulnerabilities: VulnerabilityData;
  hasVulnerabilities: boolean;
  severity: "none" | "low" | "moderate" | "high" | "critical";
}

export async function checkVulnerabilities(
  input: CheckVulnerabilitiesInput,
): Promise<CheckVulnerabilitiesResult> {
  let version = input.version;

  // If no version provided, fetch latest
  if (!version) {
    const pkg = await getPackage(input.name);
    if (!pkg) {
      throw new Error(`Package '${input.name}' not found`);
    }
    version = getLatestVersion(pkg);
  }

  const vulnerabilities = await fetchVulnerabilities(input.name, version);

  // Determine highest severity
  let severity: "none" | "low" | "moderate" | "high" | "critical" = "none";
  if (vulnerabilities.critical > 0) severity = "critical";
  else if (vulnerabilities.high > 0) severity = "high";
  else if (vulnerabilities.moderate > 0) severity = "moderate";
  else if (vulnerabilities.low > 0) severity = "low";

  return {
    name: input.name,
    version,
    vulnerabilities,
    hasVulnerabilities: vulnerabilities.total > 0,
    severity,
  };
}
