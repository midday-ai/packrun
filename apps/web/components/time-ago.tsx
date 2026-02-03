import { formatTimeAgo } from "@v1/decisions";

/**
 * Server component for displaying relative time (e.g., "3 days ago").
 * Calculates relative time on the server using server time, so it works with SSR.
 */
export function TimeAgo({ timestamp }: { timestamp: number }) {
  if (!timestamp || timestamp === 0) return null;

  const date = new Date(timestamp);
  const formatted = formatTimeAgo(date);

  return <span>{formatted}</span>;
}
