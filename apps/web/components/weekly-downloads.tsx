"use client";

import { useQuery } from "@tanstack/react-query";
import { Sparkline } from "./download-sparkline";

interface WeeklyDownloadsData {
  package: string;
  start: string;
  end: string;
  total: number;
  weeks: Array<{
    start: string;
    end: string;
    downloads: number;
  }>;
}

interface WeeklyDownloadsProps {
  packageName: string;
  /** Initial weekly downloads (server-side) to show before client fetch */
  initialWeeklyDownloads?: number;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL;

/**
 * Format number with commas (e.g., 72,545,658)
 */
function formatNumber(num: number): string {
  return num.toLocaleString("en-US");
}

/**
 * Fetch weekly downloads data from API
 */
async function fetchWeeklyDownloads(packageName: string): Promise<WeeklyDownloadsData | null> {
  if (!API_URL) return null;

  const res = await fetch(`${API_URL}/api/package/${encodeURIComponent(packageName)}/downloads`);
  if (!res.ok) return null;

  return res.json();
}

export function WeeklyDownloads({ packageName, initialWeeklyDownloads }: WeeklyDownloadsProps) {
  const { data } = useQuery({
    queryKey: ["downloads", packageName],
    queryFn: () => fetchWeeklyDownloads(packageName),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
  });

  // Extract just the download numbers for the sparkline
  const sparklineData = data?.weeks?.map((w) => w.downloads) ?? [];

  // Fixed layout - always render same structure to prevent hydration mismatch
  return (
    <div className="flex items-center justify-between gap-2 h-[52px]">
      <div className="min-w-0">
        <p className="text-xs text-[#666] uppercase tracking-wider mb-1">WEEKLY DOWNLOADS</p>
        <p className="text-lg font-mono">
          {initialWeeklyDownloads ? formatNumber(initialWeeklyDownloads) : "—"}
        </p>
      </div>
      <Sparkline
        data={sparklineData}
        width={100}
        height={32}
        strokeColor="#666"
        strokeWidth={1.5}
        fillColor="#666"
      />
    </div>
  );
}
