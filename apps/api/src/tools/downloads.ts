/**
 * Package Downloads Tool
 *
 * Fetches download history from npm and aggregates into weekly data.
 * Uses multiple strategies to avoid rate limits:
 * 1. In-memory LRU cache (24 hour TTL - downloads only update daily)
 * 2. Request throttling (max 10 concurrent requests)
 * 3. Retry with exponential backoff
 * 4. npm token authentication (increases rate limits when configured)
 */

import { api as log } from "@packrun/logger";
import { downloadsCache } from "../lib/cache";

const NPM_DOWNLOADS_API = "https://api.npmjs.org/downloads";
const NPM_TOKEN = process.env.NPM_TOKEN;

/**
 * Get headers for npm API requests (includes auth if token is configured)
 *
 * Note: Any valid npm token works for public package data (downloads, metadata).
 * No package-specific scopes are needed since this data is public. The token
 * is only used for authentication to get higher rate limits.
 */
function getNpmHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/json",
  };

  // Add Authorization header if npm token is configured
  // This increases rate limits for authenticated requests
  // Works with any valid npm token - no package scopes needed for public data
  if (NPM_TOKEN) {
    headers.Authorization = `Bearer ${NPM_TOKEN}`;
  }

  return headers;
}

// Request throttling: limit concurrent npm API requests
let activeRequests = 0;
const MAX_CONCURRENT_REQUESTS = 10;
const requestQueue: Array<() => void> = [];

/**
 * Throttle requests to npm API to prevent rate limiting
 */
async function throttleRequest<T>(fn: () => Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const execute = async () => {
      activeRequests++;
      try {
        const result = await fn();
        resolve(result);
      } catch (error) {
        reject(error);
      } finally {
        activeRequests--;
        // Process next request in queue
        if (requestQueue.length > 0) {
          const next = requestQueue.shift();
          if (next) next();
        }
      }
    };

    if (activeRequests < MAX_CONCURRENT_REQUESTS) {
      execute();
    } else {
      requestQueue.push(execute);
    }
  });
}

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
 * Sleep for a given number of milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetch from npm API with retry logic for rate limiting
 */
async function fetchWithRetry(
  url: string,
  maxRetries = 3,
  initialDelay = 1000,
): Promise<Response | null> {
  const headers = getNpmHeaders();

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const response = await fetch(url, { headers });

    // Success - return response
    if (response.ok) {
      return response;
    }

    // 404 - package not found, don't retry
    if (response.status === 404) {
      return response;
    }

    // 429 - rate limited, retry with exponential backoff
    if (response.status === 429) {
      if (attempt < maxRetries) {
        const delay = initialDelay * Math.pow(2, attempt);
        const retryAfter = response.headers.get("Retry-After");
        const waitTime = retryAfter ? Number.parseInt(retryAfter) * 1000 : delay;

        log.warn(
          `Rate limited (429), retrying in ${waitTime}ms (attempt ${attempt + 1}/${maxRetries})`,
        );
        await sleep(waitTime);
        continue;
      }
      // Max retries reached, return the 429 response
      return response;
    }

    // Other errors - return response to be handled by caller
    return response;
  }

  return null;
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
    // Check cache first
    const cacheKey = `downloads:${name}:${weeks}`;
    const cached = downloadsCache.get(cacheKey);
    if (cached) {
      return cached as WeeklyDownloadsResponse;
    }

    // Calculate date range (weeks * 7 days + buffer for partial weeks)
    const days = weeks * 7 + 14; // Extra buffer to ensure we get enough complete weeks
    const startDate = getDateNDaysAgo(days);
    const endDate = getDateNDaysAgo(1); // Yesterday (npm data has 1-day lag)

    // Fetch from npm with retry logic and throttling
    const encodedName = encodeURIComponent(name);
    const url = `${NPM_DOWNLOADS_API}/range/${startDate}:${endDate}/${encodedName}`;

    const response = await throttleRequest(() => fetchWithRetry(url));
    if (!response) {
      log.error(`Failed to fetch downloads for ${name}: fetch failed after retries`);
      return null;
    }

    if (!response.ok) {
      // 404 = package not found, 429 = rate limited after retries - both return null gracefully
      if (response.status === 404 || response.status === 429) {
        log.error(`Failed to fetch downloads for ${name}:`, response.status);
        return null;
      }
      // Other errors - log and return null
      log.error(`npm API returned ${response.status} for ${name}`);
      return null;
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

    const result: WeeklyDownloadsResponse = {
      package: name,
      start: recentWeeks[0]?.start || startDate,
      end: recentWeeks[recentWeeks.length - 1]?.end || endDate,
      total,
      weeks: recentWeeks,
    };

    // Cache successful result (24 hours TTL - downloads only update daily)
    downloadsCache.set(cacheKey, result);

    return result;
  } catch (error) {
    log.error(`Failed to fetch downloads for ${name}:`, error);
    return null;
  }
}
