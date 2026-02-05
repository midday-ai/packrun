"use client";

import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc/query";
import { Sparkline } from "./download-sparkline";

interface WeeklyDownloadsProps {
  packageName: string;
  /** Initial weekly downloads (server-side) to show before client fetch */
  initialWeeklyDownloads?: number;
}

/**
 * Format number with commas (e.g., 72,545,658)
 */
function formatNumber(num: number): string {
  return num.toLocaleString("en-US");
}

export function WeeklyDownloads({ packageName, initialWeeklyDownloads }: WeeklyDownloadsProps) {
  const { data } = useQuery({
    ...orpc.package.getDownloads.queryOptions({ input: { name: packageName } }),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
  });

  // Extract just the download numbers for the sparkline
  const sparklineData = data?.weeks?.map((w) => w.downloads) ?? [];

  // Fixed layout - always render same structure to prevent hydration mismatch
  return (
    <div className="flex items-center justify-between gap-2 h-[52px]">
      <div className="min-w-0">
        <p className="text-xs text-subtle uppercase tracking-wider mb-1">WEEKLY DOWNLOADS</p>
        <p className="text-lg font-mono">
          {initialWeeklyDownloads ? formatNumber(initialWeeklyDownloads) : "—"}
        </p>
      </div>
      <Sparkline
        data={sparklineData}
        width={100}
        height={32}
        className="text-subtle"
        strokeWidth={1.5}
      />
    </div>
  );
}
