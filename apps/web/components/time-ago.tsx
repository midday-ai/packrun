import { format } from "date-fns";

/**
 * Server component for displaying formatted date.
 * No relative time = no Date.now() = no layout shift.
 */
export function TimeAgo({ timestamp }: { timestamp: number }) {
  if (!timestamp || timestamp === 0) return null;

  const date = new Date(timestamp);
  const formatted = format(date, "MMM d, yyyy");

  return <span>{formatted}</span>;
}
