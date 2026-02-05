import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { FollowButton } from "@/components/follow-button";
import { Footer } from "@/components/footer";
import { Header } from "@/components/header";
import { HealthScoreTooltip, HealthScoreTooltipTrigger } from "@/components/health-score-tooltip";
import { InstallSizeStatCell } from "@/components/install-size-stat";
import { InstallTabs } from "@/components/install-tabs";
import { TimeAgo } from "@/components/time-ago";
import { UpcomingReleaseAlert } from "@/components/upcoming-release-alert";
import { WeeklyDownloads } from "@/components/weekly-downloads";
import { client } from "@/lib/orpc/client";
import { formatNumber, getPackage } from "@/lib/packages";
import { getStaticPackages } from "@/lib/popular-packages";

// ISR: Revalidate pages every 24 hours (on-demand revalidation handles updates)
export const revalidate = 86400;

// Allow on-demand generation for routes not in generateStaticParams
// This enables ISR for routes visited for the first time
export const dynamicParams = true;

interface PageProps {
  params: Promise<{ name: string }>;
}

export async function generateStaticParams() {
  return getStaticPackages().map((name) => ({ name }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { name } = await params;
  const decodedName = decodeURIComponent(name);
  const pkg = await getPackage(decodedName);

  if (!pkg) {
    return { title: "Package Not Found" };
  }

  // Create SEO-optimized title (aim for 50-60 chars)
  // Format: "package - brief description | packrun.dev"
  const maxTitleLength = 60;
  const suffix = " | packrun.dev"; // 9 chars
  const separator = " - "; // 3 chars
  const availableForDesc = maxTitleLength - pkg.name.length - suffix.length - separator.length;

  let title: string;
  if (pkg.description && availableForDesc > 15) {
    // Get first sentence or clause
    const firstPart = pkg.description.split(/[.!?,;]/)[0].trim();
    const briefDesc =
      firstPart.length <= availableForDesc
        ? firstPart
        : firstPart.slice(0, availableForDesc - 3).trim() + "...";
    title = `${pkg.name}${separator}${briefDesc}${suffix}`;
  } else {
    title = `${pkg.name}${suffix}`;
  }
  const description =
    pkg.description || `${pkg.name} npm package - install, documentation, and version info`;

  return {
    title,
    description,
    alternates: {
      canonical: `https://packrun.dev/${encodeURIComponent(pkg.name)}`,
    },
    openGraph: {
      title: pkg.name,
      description,
      url: `https://packrun.dev/${encodeURIComponent(pkg.name)}`,
      siteName: "packrun.dev",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: pkg.name,
      description,
    },
  };
}

export default async function PackagePage({ params }: PageProps) {
  const { name } = await params;
  const decodedName = decodeURIComponent(name);
  const pkg = await getPackage(decodedName);

  if (!pkg) {
    notFound();
  }

  const deps = Object.keys(pkg.dependencies || {});

  // Fetch upcoming releases for this package
  let upcomingRelease = null;
  try {
    const result = await client.releases.list({
      status: "upcoming",
      packageName: decodedName,
      limit: 1,
    });
    if (result.releases.length > 0) {
      upcomingRelease = result.releases[0];
    }
  } catch {
    // Ignore errors fetching releases
  }

  const softwareJsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareSourceCode",
    name: pkg.name,
    version: pkg.version,
    description: pkg.description,
    url: `https://packrun.dev/${encodeURIComponent(pkg.name)}`,
    codeRepository: pkg.repository,
    programmingLanguage: "JavaScript",
    runtimePlatform: "Node.js",
    author: pkg.author ? { "@type": "Person", name: pkg.author } : undefined,
    license: pkg.license,
    dateModified: pkg.updated ? new Date(pkg.updated).toISOString() : undefined,
  };

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Home",
        item: "https://packrun.dev",
      },
      {
        "@type": "ListItem",
        position: 2,
        name: pkg.name,
        item: `https://packrun.dev/${encodeURIComponent(pkg.name)}`,
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <main className="min-h-screen bg-background text-foreground flex flex-col">
        <Header />

        {/* Package Title Bar */}
        <div className="border-b border-border">
          <div className="container-page py-6">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div>
                <h1 className="text-2xl lg:text-3xl font-bold text-foreground tracking-tight">
                  {pkg.name}
                </h1>
                {pkg.description && (
                  <p className="mt-2 text-sm text-muted max-w-2xl">{pkg.description}</p>
                )}
                <div className="mt-3">
                  <FollowButton packageName={pkg.name} />
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-subtle uppercase tracking-wider">version</div>
                <div className="text-lg font-bold tabular-nums">{pkg.version}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Deprecated Warning */}
        {pkg.deprecated && (
          <div className="border-b border-border bg-surface">
            <div className="container-page py-3">
              <span className="text-xs uppercase tracking-wider text-foreground">deprecated</span>
              <span className="ml-3 text-sm text-muted">
                {pkg.deprecatedMessage || "This package is deprecated"}
              </span>
            </div>
          </div>
        )}

        {/* Install Scripts Warning */}
        {pkg.hasInstallScripts && (
          <div className="border-b border-border bg-surface">
            <div className="container-page py-3">
              <span className="text-xs uppercase tracking-wider text-yellow-500">
                install scripts
              </span>
              <span className="ml-3 text-sm text-muted">
                This package runs scripts during installation (preinstall/install/postinstall)
              </span>
            </div>
          </div>
        )}

        {/* Stats Bar */}
        <div className="border-b border-border">
          <div className="container-page">
            <div className="flex flex-wrap gap-y-2 -mx-4">
              <StatCell label="license" value={pkg.license || "—"} />
              <StatCell label="deps" value={String(pkg.dependencyCount)} />
              <InstallSizeStatCell
                name={pkg.name}
                version={pkg.version}
                unpackedSize={pkg.unpackedSize}
              />
              {pkg.health ? (
                <VulnStatCellFromHealth vulns={pkg.health.security.vulnerabilities.total} />
              ) : (
                <Suspense fallback={<StatCell label="vulns" value="—" />}>
                  <VulnStatCell packageName={pkg.name} version={pkg.version} />
                </Suspense>
              )}
              <StatCell label="downloads" value={`${formatNumber(pkg.downloads)}/wk`} />
              {pkg.stars !== undefined && pkg.stars > 0 && (
                <StarsStatCell stars={pkg.stars} repository={pkg.repository} />
              )}
              {pkg.health && (
                <HealthScoreCell score={pkg.health.health.score} grade={pkg.health.health.grade} />
              )}
              {pkg.updated > 0 && (
                <StatCell label="updated" value={<TimeAgo timestamp={pkg.updated} />} />
              )}
            </div>
          </div>
        </div>

        {/* Replacement Warning */}
        {pkg.health?.replacement && pkg.health.replacement.type !== "none" && (
          <div className="border-b border-border bg-green-950/30 dark:bg-green-950/50">
            <div className="container-page py-3">
              <span className="text-xs uppercase tracking-wider text-green-400">
                {pkg.health.replacement.type === "native"
                  ? "native alternative"
                  : "better alternative"}
              </span>
              {pkg.health.replacement.useInstead && (
                <span className="ml-3 text-sm text-muted">
                  Consider using{" "}
                  <Link
                    href={`/${encodeURIComponent(pkg.health.replacement.useInstead)}`}
                    className="text-green-400 hover:text-green-300"
                  >
                    {pkg.health.replacement.useInstead}
                  </Link>
                  {pkg.health.replacement.reason && ` — ${pkg.health.replacement.reason}`}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Main Content */}
        <div className="container-page w-full" style={{ paddingBottom: "150px" }}>
          <div className="flex flex-col lg:flex-row">
            {/* Left: Main Content */}
            <div className="flex-1 min-w-0 lg:border-r border-border">
              {/* Upcoming Release Alert */}
              {upcomingRelease && (
                <section className="border-b border-border py-4 lg:pr-8">
                  <UpcomingReleaseAlert release={upcomingRelease} />
                </section>
              )}

              {/* Install Section */}
              <section className="border-b border-border py-6 lg:pr-8">
                <InstallTabs packageName={pkg.name} hasTypes={pkg.hasTypes} />
              </section>

              {/* README Section */}
              {pkg.readmeHtml && (
                <section className="border-b border-border py-6 lg:pr-8">
                  <h2 className="text-xs uppercase tracking-widest text-subtle mb-4">readme</h2>
                  <div
                    className="readme max-w-none"
                    dangerouslySetInnerHTML={{ __html: pkg.readmeHtml }}
                  />
                </section>
              )}

              {/* Dependencies Section */}
              {deps.length > 0 && (
                <section className="py-6 lg:pr-8">
                  <h2 className="text-xs uppercase tracking-widest text-subtle mb-4">
                    dependencies [{deps.length}]
                  </h2>
                  <div className="flex flex-wrap gap-1">
                    {deps.slice(0, 50).map((dep) => (
                      <Link
                        key={dep}
                        href={`/${encodeURIComponent(dep)}`}
                        className="text-xs px-2 py-1 border border-border text-muted hover:text-foreground hover:border-foreground transition-colors"
                      >
                        {dep}
                      </Link>
                    ))}
                    {deps.length > 50 && (
                      <span className="text-xs px-2 py-1 text-faint">+{deps.length - 50}</span>
                    )}
                  </div>
                </section>
              )}
            </div>

            {/* Right: Sidebar */}
            <aside className="w-full lg:w-64 shrink-0 lg:pl-6">
              {/* Downloads with Sparkline */}
              <div className="border-b border-border py-4">
                <WeeklyDownloads packageName={pkg.name} initialWeeklyDownloads={pkg.downloads} />
              </div>

              {/* Version */}
              <div className="border-b border-border py-4">
                <h3 className="text-xs uppercase tracking-widest text-subtle mb-2">latest</h3>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-foreground font-bold tabular-nums">
                    {pkg.version}
                  </span>
                  {pkg.updated > 0 && (
                    <span className="text-xs text-subtle">
                      <TimeAgo timestamp={pkg.updated} />
                    </span>
                  )}
                </div>
              </div>

              {/* Module */}
              <div className="border-b border-border py-4">
                <h3 className="text-xs uppercase tracking-widest text-subtle mb-3">module</h3>
                <div className="flex flex-wrap gap-2">
                  {pkg.hasTypes && (
                    <span className="text-xs border border-foreground text-foreground px-2 py-0.5">
                      TS
                    </span>
                  )}
                  {!pkg.hasTypes && pkg.typesPackage && (
                    <Link
                      href={`/${encodeURIComponent(pkg.typesPackage)}`}
                      className="text-xs border border-blue-400/50 text-blue-400 px-2 py-0.5 hover:border-blue-400 transition-colors"
                    >
                      @types
                    </Link>
                  )}
                  {pkg.isESM && (
                    <span className="text-xs border border-subtle text-muted px-2 py-0.5">ESM</span>
                  )}
                  {pkg.isCJS && (
                    <span className="text-xs border border-subtle text-muted px-2 py-0.5">CJS</span>
                  )}
                  {!pkg.hasTypes && !pkg.typesPackage && !pkg.isESM && !pkg.isCJS && (
                    <span className="text-xs text-faint">—</span>
                  )}
                </div>
              </div>

              {/* Health Score */}
              {pkg.health && (
                <div className="border-b border-border py-4">
                  <h3 className="text-xs uppercase tracking-widest text-subtle mb-3 flex items-center gap-1.5">
                    health score
                    <HealthScoreTooltipTrigger />
                  </h3>
                  <div className="flex items-center gap-3">
                    <span
                      className="text-2xl font-bold"
                      style={{ color: getGradeColor(pkg.health.health.grade) }}
                    >
                      {pkg.health.health.grade}
                    </span>
                    <span className="text-sm text-muted">{pkg.health.health.score}/100</span>
                  </div>
                  <div className="text-xs text-subtle mt-1">{pkg.health.health.status}</div>
                </div>
              )}

              {/* Alternatives */}
              {pkg.health?.alternatives && pkg.health.alternatives.length > 0 && (
                <div className="border-b border-border py-4">
                  <h3 className="text-xs uppercase tracking-widest text-subtle mb-3">
                    alternatives
                  </h3>
                  <div className="space-y-2">
                    {pkg.health.alternatives.slice(0, 5).map((alt) => (
                      <Link
                        key={alt.name}
                        href={`/${encodeURIComponent(alt.name)}`}
                        className="block text-sm text-muted hover:text-foreground transition-colors"
                      >
                        {alt.name}
                        <span className="text-xs text-subtle ml-2">
                          {formatNumber(alt.downloads)}/wk
                        </span>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {/* Maintainers */}
              {pkg.maintainers && pkg.maintainers.length > 0 && (
                <div className="border-b border-border py-4">
                  <h3 className="text-xs uppercase tracking-widest text-subtle mb-3">
                    maintainers
                  </h3>
                  <div className="space-y-1">
                    {pkg.maintainers.slice(0, 5).map((m) => (
                      <Link
                        key={m}
                        href={`https://www.npmjs.com/~${m}`}
                        target="_blank"
                        className="block text-sm text-muted hover:text-foreground transition-colors"
                      >
                        ~{m}
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {/* Keywords */}
              {pkg.keywords && pkg.keywords.length > 0 && (
                <div className="border-b border-border py-4">
                  <h3 className="text-xs uppercase tracking-widest text-subtle mb-3">keywords</h3>
                  <div className="text-sm text-muted space-y-0.5">
                    {pkg.keywords.slice(0, 8).map((k) => (
                      <div key={k}>— {k}</div>
                    ))}
                  </div>
                </div>
              )}

              {/* Compatibility */}
              {pkg.nodeVersion && (
                <div className="border-b border-border py-4">
                  <h3 className="text-xs uppercase tracking-widest text-subtle mb-2">node</h3>
                  <div className="text-sm text-muted">{pkg.nodeVersion}</div>
                </div>
              )}

              {/* Links */}
              <div className="border-b border-border py-4">
                <h3 className="text-xs uppercase tracking-widest text-subtle mb-3">links</h3>
                <div className="space-y-1 text-sm">
                  <Link
                    href={`https://www.npmjs.com/package/${pkg.name}`}
                    target="_blank"
                    className="block text-muted hover:text-foreground transition-colors"
                  >
                    npm ↗
                  </Link>
                  {pkg.repository && (
                    <Link
                      href={pkg.repository}
                      target="_blank"
                      className="block text-muted hover:text-foreground transition-colors"
                    >
                      {pkg.repository.includes("github") ? "github" : "repository"} ↗
                    </Link>
                  )}
                  {pkg.homepage && pkg.homepage !== pkg.repository && (
                    <Link
                      href={pkg.homepage}
                      target="_blank"
                      className="block text-muted hover:text-foreground transition-colors"
                    >
                      homepage ↗
                    </Link>
                  )}
                  {pkg.funding && (
                    <Link
                      href={pkg.funding}
                      target="_blank"
                      className="block text-pink-400 hover:text-pink-300 transition-colors"
                    >
                      ♥ sponsor ↗
                    </Link>
                  )}
                </div>
              </div>

              {/* Install MCP */}
              <div className="py-4">
                <Link
                  href="cursor://anysphere.cursor-deeplink/mcp/install?name=packrun&config=eyJ1cmwiOiJodHRwczovL2FwaS5wYWNrcnVuLmRldi9tY3AifQ=="
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 border border-border text-xs text-muted hover:text-foreground hover:border-subtle transition-colors"
                >
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 130 145"
                    fill="currentColor"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path d="M 60.66 0.00 L 64.42 0.00 C 82.67 10.62 100.99 21.12 119.25 31.72 C 121.24 33.01 123.54 34.18 124.72 36.34 C 125.34 39.17 125.06 42.10 125.11 44.98 C 125.07 63.63 125.08 82.28 125.11 100.93 C 125.07 102.84 125.14 104.79 124.73 106.68 C 123.53 108.54 121.50 109.62 119.68 110.77 C 104.03 119.72 88.45 128.80 72.85 137.83 C 69.53 139.68 66.36 141.91 62.74 143.17 C 60.51 142.85 58.57 141.57 56.62 140.54 C 40.81 131.22 24.82 122.22 9.00 112.92 C 5.85 111.16 2.79 109.23 0.00 106.93 L 0.00 36.10 C 3.83 32.32 8.81 30.12 13.34 27.33 C 29.10 18.19 44.82 8.98 60.66 0.00 M 5.62 38.04 C 8.28 40.64 11.88 41.83 14.96 43.80 C 30.60 53.06 46.50 61.89 62.05 71.30 C 62.86 75.82 62.50 80.43 62.55 85.00 C 62.57 100.64 62.51 116.29 62.54 131.93 C 62.54 133.69 62.72 135.44 63.01 137.17 C 64.18 135.60 65.29 133.98 66.24 132.27 C 83.07 103.08 99.93 73.92 116.65 44.67 C 117.89 42.62 118.84 40.42 119.57 38.14 C 113.41 37.65 107.23 37.91 101.06 37.87 C 73.71 37.85 46.35 37.85 18.99 37.87 C 14.54 38.02 10.07 37.53 5.62 38.04 Z" />
                  </svg>
                  Install MCP
                </Link>
              </div>
            </aside>
          </div>
        </div>

        <Footer />
      </main>
    </>
  );
}

function StatCell({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex-1 min-w-[64px] sm:min-w-[80px] px-3 py-3">
      <div className="text-[10px] uppercase tracking-widest text-subtle">{label}</div>
      <div className="text-sm text-foreground font-medium tabular-nums">{value}</div>
    </div>
  );
}

function VulnStatCellFromHealth({ vulns }: { vulns: number }) {
  return (
    <div className="flex-1 min-w-[64px] sm:min-w-[80px] px-3 py-3">
      <div className="text-[10px] uppercase tracking-widest text-subtle">vulns</div>
      <div
        className={`text-sm font-medium tabular-nums ${vulns > 0 ? "text-red-400" : "text-foreground"}`}
      >
        {vulns}
      </div>
    </div>
  );
}

function HealthScoreCell({ score, grade }: { score: number; grade: string }) {
  return (
    <HealthScoreTooltip className="flex flex-1 min-w-[64px] sm:min-w-[80px] px-3 py-3">
      <div>
        <div className="text-[10px] uppercase tracking-widest text-subtle">health</div>
        <div className="text-sm font-medium" style={{ color: getGradeColor(grade) }}>
          {grade} ({score})
        </div>
      </div>
    </HealthScoreTooltip>
  );
}

function StarsStatCell({ stars, repository }: { stars: number; repository?: string }) {
  const content = (
    <>
      <div className="text-[10px] uppercase tracking-widest text-subtle">stars</div>
      <div className="text-sm text-foreground font-medium tabular-nums">{formatNumber(stars)}</div>
    </>
  );

  if (repository) {
    return (
      <Link
        href={repository}
        target="_blank"
        rel="noopener noreferrer"
        className="flex-1 min-w-[64px] sm:min-w-[80px] px-3 py-3 hover:bg-surface transition-colors"
      >
        {content}
      </Link>
    );
  }

  return <div className="flex-1 min-w-[64px] sm:min-w-[80px] px-3 py-3">{content}</div>;
}

function getGradeColor(grade: string): string {
  switch (grade) {
    case "A":
      return "var(--health-a)";
    case "B":
      return "var(--health-b)";
    case "C":
      return "var(--health-c)";
    case "D":
      return "var(--health-d)";
    case "F":
      return "var(--health-f)";
    default:
      return "var(--color-foreground)";
  }
}

async function VulnStatCell({ packageName, version }: { packageName: string; version: string }) {
  const { fetchVulnerabilities } = await import("@/lib/api");

  try {
    const response = await fetchVulnerabilities(packageName, version);
    if (!response) return <StatCell label="vulns" value="—" />;

    const count = response.vulnerabilities.total;

    return (
      <div className="flex-1 min-w-[64px] sm:min-w-[80px] px-3 py-3">
        <div className="text-[10px] uppercase tracking-widest text-subtle">vulns</div>
        <div className="text-sm font-medium tabular-nums text-foreground">{count}</div>
      </div>
    );
  } catch {
    return <StatCell label="vulns" value="—" />;
  }
}
