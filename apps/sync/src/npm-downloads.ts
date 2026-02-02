/**
 * npm downloads API client
 */

import type { NpmDownloadData } from "@v1/decisions/schema";

const NPM_DOWNLOADS_API = "https://api.npmjs.org/downloads";

interface DownloadPoint {
  downloads: number;
  day: string;
}

interface DownloadRange {
  downloads: number;
  start: string;
  end: string;
  package: string;
}

/**
 * Fetch weekly downloads for a package
 */
export async function fetchWeeklyDownloads(packageName: string): Promise<number | null> {
  try {
    const response = await fetch(
      `${NPM_DOWNLOADS_API}/point/last-week/${encodeURIComponent(packageName)}`,
    );

    if (!response.ok) {
      return null;
    }

    const data: DownloadRange = await response.json();
    return data.downloads;
  } catch (error) {
    console.error(`Error fetching weekly downloads for ${packageName}:`, error);
    return null;
  }
}

/**
 * Fetch download history (last 3 months, weekly)
 */
export async function fetchDownloadHistory(packageName: string): Promise<NpmDownloadData | null> {
  try {
    // Fetch last 90 days of downloads
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 90);

    const formatDate = (d: Date) => d.toISOString().split("T")[0];

    const response = await fetch(
      `${NPM_DOWNLOADS_API}/range/${formatDate(startDate)}:${formatDate(endDate)}/${encodeURIComponent(packageName)}`,
    );

    if (!response.ok) {
      return null;
    }

    const data: { downloads: DownloadPoint[] } = await response.json();

    // Aggregate into weekly buckets
    const weeklyData: Record<string, number> = {};
    for (const point of data.downloads) {
      const week = getWeekKey(new Date(point.day));
      weeklyData[week] = (weeklyData[week] || 0) + point.downloads;
    }

    const downloadHistory = Object.entries(weeklyData)
      .map(([week, downloads]) => ({ week, downloads }))
      .sort((a, b) => a.week.localeCompare(b.week));

    // Calculate totals
    const weeklyDownloads =
      downloadHistory.length > 0 ? downloadHistory[downloadHistory.length - 1].downloads : 0;
    const monthlyDownloads = downloadHistory.slice(-4).reduce((sum, w) => sum + w.downloads, 0);

    return {
      weeklyDownloads,
      monthlyDownloads,
      downloadHistory,
    };
  } catch (error) {
    console.error(`Error fetching download history for ${packageName}:`, error);
    return null;
  }
}

/**
 * Get ISO week key for a date
 */
function getWeekKey(date: Date): string {
  const year = date.getFullYear();
  const startOfYear = new Date(year, 0, 1);
  const days = Math.floor((date.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000));
  const weekNumber = Math.ceil((days + startOfYear.getDay() + 1) / 7);
  return `${year}-W${String(weekNumber).padStart(2, "0")}`;
}
