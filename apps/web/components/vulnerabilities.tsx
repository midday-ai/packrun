/**
 * Vulnerabilities Component
 *
 * Async server component that checks for security vulnerabilities.
 * This streams via Suspense since it uses the packrun API.
 */

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fetchVulnerabilities, type VulnerabilityData } from "@/lib/api";

interface VulnerabilitiesProps {
  packageName: string;
  version: string;
}

export async function Vulnerabilities({ packageName, version }: VulnerabilitiesProps) {
  const response = await fetchVulnerabilities(packageName, version);
  const data: VulnerabilityData | null = response?.vulnerabilities ?? null;

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
