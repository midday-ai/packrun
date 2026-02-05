import Link from "next/link";
import { ReleasesCarousel } from "@/components/releases-carousel";
import { client } from "@/lib/orpc/client";

interface UpcomingReleasesWidgetProps {
  /** If provided, only show releases for this package */
  packageName?: string;
  /** Maximum number of releases to show */
  limit?: number;
  /** Title to display */
  title?: string;
  /** Display as carousel (for homepage) or compact list (for sidebar) */
  variant?: "carousel" | "compact";
}

async function getReleases(packageName?: string, limit = 3) {
  try {
    const result = await client.releases.list({
      status: "upcoming",
      packageName,
      limit,
    });
    return result.releases;
  } catch (error) {
    console.error("Failed to fetch upcoming releases:", error);
    return [];
  }
}

export async function UpcomingReleasesWidget({
  packageName,
  limit = 3,
  title = "Upcoming Releases",
  variant = "compact",
}: UpcomingReleasesWidgetProps) {
  const releases = await getReleases(packageName, limit);

  // Don't render if no releases
  if (releases.length === 0) {
    return null;
  }

  if (variant === "carousel") {
    return <ReleasesCarousel releases={releases} title={title} />;
  }

  // Compact variant (for sidebar)
  return (
    <div className="border border-border p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs uppercase tracking-wider text-subtle">{title}</h3>
        <Link
          href="/releases"
          className="text-xs text-muted hover:text-foreground transition-colors"
        >
          View all →
        </Link>
      </div>
      <div className="space-y-3">
        {releases.map((release) => (
          <div key={release.id}>
            <div className="flex items-center gap-2">
              <span className="text-sm text-foreground font-medium truncate">{release.title}</span>
              {release.targetVersion && (
                <span className="text-xs text-subtle">v{release.targetVersion}</span>
              )}
            </div>
            {release.packageName && !packageName && (
              <Link
                href={`/${encodeURIComponent(release.packageName)}`}
                className="text-xs text-muted hover:text-foreground transition-colors"
              >
                {release.packageName}
              </Link>
            )}
            {release.description && (
              <p className="text-xs text-muted line-clamp-1 mt-0.5">{release.description}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
