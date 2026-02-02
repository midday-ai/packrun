/**
 * OSV (Open Source Vulnerabilities) API Client
 *
 * Fetches vulnerability data from api.osv.dev for npm packages.
 */

const OSV_API = "https://api.osv.dev/v1";

interface OsvVulnerability {
  id: string;
  summary?: string;
  severity?: Array<{
    type: string;
    score: string;
  }>;
  database_specific?: {
    severity?: string;
  };
}

interface OsvQueryResponse {
  vulns?: OsvVulnerability[];
}

/**
 * Vulnerability counts by severity
 */
export interface VulnerabilityData {
  total: number;
  critical: number;
  high: number;
  moderate: number;
  low: number;
}

function getSeverity(vuln: OsvVulnerability): string {
  // Try CVSS score first
  if (vuln.severity && vuln.severity.length > 0) {
    const cvss = vuln.severity.find((s) => s.type === "CVSS_V3" || s.type === "CVSS_V2");
    if (cvss) {
      const score = Number.parseFloat(cvss.score);
      if (score >= 9.0) return "critical";
      if (score >= 7.0) return "high";
      if (score >= 4.0) return "moderate";
      return "low";
    }
  }

  // Fall back to database-specific severity
  if (vuln.database_specific?.severity) {
    const sev = vuln.database_specific.severity.toLowerCase();
    if (sev === "critical") return "critical";
    if (sev === "high") return "high";
    if (sev === "moderate" || sev === "medium") return "moderate";
    if (sev === "low") return "low";
  }

  return "unknown";
}

/**
 * Fetch vulnerabilities for a specific package version
 */
export async function fetchVulnerabilities(
  packageName: string,
  version: string,
): Promise<VulnerabilityData> {
  const result: VulnerabilityData = {
    total: 0,
    critical: 0,
    high: 0,
    moderate: 0,
    low: 0,
  };

  try {
    const response = await fetch(`${OSV_API}/query`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        package: { name: packageName, ecosystem: "npm" },
        version,
      }),
    });

    if (!response.ok) {
      return result;
    }

    const data = (await response.json()) as OsvQueryResponse;

    if (!data.vulns || data.vulns.length === 0) {
      return result;
    }

    result.total = data.vulns.length;

    for (const vuln of data.vulns) {
      const severity = getSeverity(vuln);
      switch (severity) {
        case "critical":
          result.critical++;
          break;
        case "high":
          result.high++;
          break;
        case "moderate":
          result.moderate++;
          break;
        case "low":
          result.low++;
          break;
      }
    }

    return result;
  } catch (error) {
    console.error(`[OSV] Error fetching vulnerabilities for ${packageName}@${version}:`, error);
    return result;
  }
}

/**
 * Batch fetch vulnerabilities for multiple packages
 */
export async function fetchVulnerabilitiesBatch(
  packages: Array<{ name: string; version: string }>,
): Promise<Map<string, VulnerabilityData>> {
  const results = new Map<string, VulnerabilityData>();
  const batchSize = 10;

  for (let i = 0; i < packages.length; i += batchSize) {
    const batch = packages.slice(i, i + batchSize);
    const promises = batch.map(async (pkg) => {
      const vulns = await fetchVulnerabilities(pkg.name, pkg.version);
      results.set(pkg.name, vulns);
    });
    await Promise.all(promises);
  }

  return results;
}
