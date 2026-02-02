/**
 * Vulnerabilities Component
 *
 * Async server component that checks for security vulnerabilities.
 * This streams via Suspense since it requires calling the OSV API.
 */

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface VulnerabilitiesProps {
  packageName: string;
  version: string;
}

interface VulnerabilityData {
  total: number;
  critical: number;
  high: number;
  moderate: number;
  low: number;
}

/**
 * Query the OSV API for vulnerabilities.
 */
async function analyzeVulnerabilities(
  name: string,
  version: string,
): Promise<VulnerabilityData | null> {
  try {
    const res = await fetch("https://api.osv.dev/v1/query", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        package: { name, ecosystem: "npm" },
        version,
      }),
      next: { revalidate: 3600 }, // Cache for 1 hour
    });

    if (!res.ok) return null;

    const data = await res.json();
    const vulns = data.vulns || [];

    // Count by severity
    let critical = 0;
    let high = 0;
    let moderate = 0;
    let low = 0;

    for (const vuln of vulns) {
      const severity = vuln.database_specific?.severity?.toLowerCase() || "";
      if (severity === "critical") critical++;
      else if (severity === "high") high++;
      else if (severity === "moderate" || severity === "medium") moderate++;
      else low++;
    }

    return {
      total: vulns.length,
      critical,
      high,
      moderate,
      low,
    };
  } catch {
    return null;
  }
}

export async function Vulnerabilities({ packageName, version }: VulnerabilitiesProps) {
  const data = await analyzeVulnerabilities(packageName, version);

  if (!data) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Security</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">Unable to check</div>
        </CardContent>
      </Card>
    );
  }

  if (data.total === 0) {
    return (
      <Card className="border-green-500/20">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Security</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500" />
            <span className="text-sm text-green-400">No known vulnerabilities</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-red-500/20">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Security</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-red-500" />
          <span className="text-sm text-red-400">
            {data.total} {data.total === 1 ? "vulnerability" : "vulnerabilities"} found
          </span>
        </div>

        <div className="flex flex-wrap gap-2">
          {data.critical > 0 && (
            <Badge variant="outline" className="border-red-500 text-red-400">
              {data.critical} Critical
            </Badge>
          )}
          {data.high > 0 && (
            <Badge variant="outline" className="border-orange-500 text-orange-400">
              {data.high} High
            </Badge>
          )}
          {data.moderate > 0 && (
            <Badge variant="outline" className="border-yellow-500 text-yellow-400">
              {data.moderate} Moderate
            </Badge>
          )}
          {data.low > 0 && (
            <Badge variant="outline" className="border-blue-500 text-blue-400">
              {data.low} Low
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function VulnerabilitiesSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Security</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-muted animate-pulse" />
          <div className="h-4 w-32 bg-muted animate-pulse rounded" />
        </div>
      </CardContent>
    </Card>
  );
}
