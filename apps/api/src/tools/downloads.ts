/**
 * Package Downloads Tool
 *
 * Fetches download history from npm and aggregates into weekly data.
 */

const NPM_DOWNLOADS_API = "https://api.npmjs.org/downloads";

/**
 * Weekly download data point
 */
export interface WeeklyDataPoint {
  start: string; // "2026-01-26"
  end: string; // "2026-02-01"
  downloads: number;
}

/**
 * Response for weekly downloads endpoint
 */
export interface WeeklyDownloadsResponse {
  package: string;
  start: string; // First week start
  end: string; // Last week end
  total: number; // Sum of all downloads
  weeks: WeeklyDataPoint[];
}

/**
 * Raw npm downloads range response
 */
interface NpmDownloadsRangeResponse {
  start: string;
  end: string;
  package: string;
  downloads: Array<{ day: string; downloads: number }>;
}

/**
 * Get the date string for N days ago
 */
function getDateNDaysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().split("T")[0]!;
}

/**
 * Get the start of the week (Sunday) for a given date
 */
function getWeekStart(dateStr: string): string {
  const date = new Date(dateStr);
  const day = date.getDay();
  date.setDate(date.getDate() - day);
  return date.toISOString().split("T")[0]!;
}

/**
 * Aggregate daily downloads into weekly buckets
 */
function aggregateToWeeks(downloads: Array<{ day: string; downloads: number }>): WeeklyDataPoint[] {
  const weekMap = new Map<string, { start: string; end: string; downloads: number }>();

  for (const { day, downloads: count } of downloads) {
    const weekStart = getWeekStart(day);

    if (!weekMap.has(weekStart)) {
      // Calculate week end (Saturday)
      const startDate = new Date(weekStart);
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 6);

      weekMap.set(weekStart, {
        start: weekStart,
        end: endDate.toISOString().split("T")[0]!,
        downloads: 0,
      });
    }

    const week = weekMap.get(weekStart)!;
    week.downloads += count;
  }

  // Sort by week start date and return as array
  return Array.from(weekMap.values()).sort((a, b) => a.start.localeCompare(b.start));
}

/**
 * Check if a week is complete (has all 7 days of data up to yesterday)
 */
function isWeekComplete(weekEnd: string, yesterday: string): boolean {
  // A week is complete if its end date is on or before yesterday
  return weekEnd <= yesterday;
}

/**
 * Fetch weekly download history for a package
 *
 * @param name - Package name
 * @param weeks - Number of weeks to fetch (default 52)
 */
export async function getWeeklyDownloads(
  name: string,
  weeks = 52,
): Promise<WeeklyDownloadsResponse | null> {
  try {
    // Calculate date range (weeks * 7 days + buffer for partial weeks)
    const days = weeks * 7 + 14; // Extra buffer to ensure we get enough complete weeks
    const startDate = getDateNDaysAgo(days);
    const endDate = getDateNDaysAgo(1); // Yesterday (npm data has 1-day lag)

    // Fetch from npm
    const encodedName = encodeURIComponent(name);
    const url = `${NPM_DOWNLOADS_API}/range/${startDate}:${endDate}/${encodedName}`;

    const response = await fetch(url);
    if (!response.ok) {
      if (response.status === 404) return null;
      throw new Error(`npm API returned ${response.status}`);
    }

    const data: NpmDownloadsRangeResponse = await response.json();

    // Aggregate into weeks
    const weeklyData = aggregateToWeeks(data.downloads);

    // Filter out incomplete weeks (current week that hasn't ended yet)
    const completeWeeks = weeklyData.filter((week) => isWeekComplete(week.end, endDate));

    // Take only the requested number of weeks (most recent)
    const recentWeeks = completeWeeks.slice(-weeks);

    // Calculate total
    const total = recentWeeks.reduce((sum, week) => sum + week.downloads, 0);

    return {
      package: name,
      start: recentWeeks[0]?.start || startDate,
      end: recentWeeks[recentWeeks.length - 1]?.end || endDate,
      total,
      weeks: recentWeeks,
    };
  } catch (error) {
    console.error(`[Downloads] Failed to fetch downloads for ${name}:`, error);
    return null;
  }
}
