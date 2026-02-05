"use client";

import Link from "next/link";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";

interface Release {
  id: string;
  packageName: string | null;
  title: string;
  description: string | null;
  targetVersion: string;
}

interface ReleasesCarouselProps {
  releases: Release[];
  title?: string;
}

export function ReleasesCarousel({ releases, title = "Upcoming Releases" }: ReleasesCarouselProps) {
  // Group releases into pages of 3
  const pages: Release[][] = [];
  for (let i = 0; i < releases.length; i += 3) {
    pages.push(releases.slice(i, i + 3));
  }

  return (
    <div className="w-full pt-12">
      <Carousel
        opts={{
          align: "start",
          loop: false,
        }}
        className="w-full"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xs uppercase tracking-wider text-subtle">{title}</h3>
          {pages.length > 1 && (
            <div className="flex items-center gap-1">
              <CarouselPrevious className="static translate-y-0 h-5 w-5" />
              <CarouselNext className="static translate-y-0 h-5 w-5" />
            </div>
          )}
        </div>

        <CarouselContent>
          {pages.map((pageReleases, pageIndex) => (
            <CarouselItem key={pageIndex}>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {pageReleases.map((release) => (
                  <Link
                    key={release.id}
                    href={
                      release.packageName
                        ? `/${encodeURIComponent(release.packageName)}`
                        : "/releases"
                    }
                    className="border border-border p-4 hover:border-subtle transition-colors group"
                  >
                    <div>
                      <div className="text-xs text-foreground font-medium truncate group-hover:text-foreground/90">
                        {release.title}
                      </div>
                      {release.targetVersion && (
                        <div className="text-xs text-subtle mt-0.5">v{release.targetVersion}</div>
                      )}
                    </div>
                    {release.description && (
                      <p className="text-xs text-muted line-clamp-2 mt-3">{release.description}</p>
                    )}
                    {release.packageName && (
                      <div className="text-[10px] text-faint mt-2 uppercase tracking-wider">
                        {release.packageName}
                      </div>
                    )}
                  </Link>
                ))}
              </div>
            </CarouselItem>
          ))}
        </CarouselContent>

        <div className="flex justify-center mt-4">
          <Link href="/releases" className="text-xs text-faint hover:text-muted transition-colors">
            View all →
          </Link>
        </div>
      </Carousel>
    </div>
  );
}
