import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Footer } from "@/components/footer";
import { Header } from "@/components/header";
import { type Release, ReleaseCard } from "@/components/release-card";
import { ReleasesFilter } from "@/components/releases-filter";
import { client } from "@/lib/orpc/client";

// ISR: Revalidate every hour
export const revalidate = 3600;

// Static generation for all status variants
export function generateStaticParams() {
  return [{ status: "upcoming" }, { status: "released" }, { status: "all" }];
}

const validStatuses = ["upcoming", "released", "all"] as const;
type StatusParam = (typeof validStatuses)[number];

interface PageProps {
  params: Promise<{ status: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { status } = await params;

  const titles: Record<StatusParam, string> = {
    upcoming: "Upcoming Releases",
    released: "Released",
    all: "All Releases",
  };

  const title = titles[status as StatusParam] || "Releases";

  return {
    title: `${title} | packrun.dev`,
    description: "Track npm package releases. Follow releases to get notified when they ship.",
  };
}

async function getReleases(status?: "upcoming" | "released") {
  try {
    const result = await client.releases.list({ status, limit: 50 });
    return result.releases;
  } catch (error) {
    console.error("Failed to fetch releases:", error);
    return [];
  }
}

export default async function ReleasesStatusPage({ params }: PageProps) {
  const { status: statusParam } = await params;

  // Validate status parameter
  if (!validStatuses.includes(statusParam as StatusParam)) {
    notFound();
  }

  const status =
    statusParam === "released" ? "released" : statusParam === "all" ? undefined : "upcoming";

  const releases = await getReleases(status);

  return (
    <main className="min-h-screen bg-background text-foreground font-mono flex flex-col">
      <Header />

      <div className="container-page py-8 flex-1">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-base font-bold">Upcoming Releases</h1>
            <p className="text-xs text-muted mt-1">
              Follow releases to get notified when they ship
            </p>
          </div>

          <Link
            href="/releases/submit"
            className="text-xs px-3 py-1.5 border border-border text-subtle hover:text-foreground hover:border-foreground transition-colors"
          >
            Submit Release
          </Link>
        </div>

        {/* Filters */}
        <ReleasesFilter currentStatus={statusParam as StatusParam} />

        {/* Grid */}
        {releases.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted">No releases found</p>
            <Link
              href="/releases/submit"
              className="inline-block mt-4 text-xs text-subtle hover:text-foreground transition-colors"
            >
              Be the first to submit one →
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {releases.map((release) => (
              <ReleaseCard key={release.id} release={release as Release} />
            ))}
          </div>
        )}
      </div>

      <Footer />
    </main>
  );
}
