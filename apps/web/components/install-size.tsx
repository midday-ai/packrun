/**
 * Install Size Component
 *
 * Async server component that calculates and displays package install size.
 * This streams via Suspense since it requires resolving the dependency tree.
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatBytes, formatNumber } from "@/lib/packages";

interface InstallSizeProps {
  name: string;
  version: string;
}

interface InstallSizeData {
  selfSize: number;
  totalSize: number;
  dependencyCount: number;
}

/**
 * Calculate install size by resolving dependencies.
 * This is expensive so we cache the results.
 */
async function calculateInstallSize(
  name: string,
  version: string,
): Promise<InstallSizeData | null> {
  try {
    // Fetch package metadata to get unpackedSize and dependencies
    const res = await fetch(
      `https://registry.npmjs.org/${encodeURIComponent(name)}/${version}`,
      { next: { revalidate: 3600 } }, // Cache for 1 hour
    );

    if (!res.ok) return null;

    const data = await res.json();
    const selfSize = data.dist?.unpackedSize || 0;
    const dependencies = data.dependencies || {};
    const dependencyCount = Object.keys(dependencies).length;

    // For now, just return self size - full tree calculation would be expensive
    // In a production app, this would resolve the full dependency tree
    return {
      selfSize,
      totalSize: selfSize, // Simplified - would calculate full tree in production
      dependencyCount,
    };
  } catch {
    return null;
  }
}

export async function InstallSize({ name, version }: InstallSizeProps) {
  const data = await calculateInstallSize(name, version);

  if (!data) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Install Size</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">Unable to calculate</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Install Size</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div>
          <div className="text-2xl font-mono font-bold">{formatBytes(data.selfSize)}</div>
          <div className="text-xs text-muted-foreground">unpacked size</div>
        </div>
        {data.dependencyCount > 0 && (
          <div className="text-sm text-muted-foreground">
            {formatNumber(data.dependencyCount)} dependencies
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function InstallSizeSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Install Size</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-8 w-24 bg-muted animate-pulse rounded mb-2" />
        <div className="h-4 w-16 bg-muted animate-pulse rounded" />
      </CardContent>
    </Card>
  );
}
