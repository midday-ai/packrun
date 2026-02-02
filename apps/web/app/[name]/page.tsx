import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { SearchTrigger } from "@/components/command-search";
import { InstallTabs } from "@/components/install-tabs";
import { TimeAgo } from "@/components/time-ago";
import { WeeklyDownloads } from "@/components/weekly-downloads";
import { formatBytes, formatNumber, getPackage } from "@/lib/packages";
import { getStaticPackages } from "@/lib/popular-packages";

// ISR: Revalidate pages every 24 hours (on-demand revalidation handles updates)
export const revalidate = 86400;

interface PageProps {
  params: Promise<{ name: string }>;
}

export async function generateStaticParams() {
  return getStaticPackages().map((name) => ({ name }));
}

export async function generateMetadata({ params }: PageProps) {
  const { name } = await params;
  const decodedName = decodeURIComponent(name);
  const pkg = await getPackage(decodedName);

  if (!pkg) {
    return { title: "Package Not Found" };
  }

  return {
    title: `${pkg.name} — v1.run`,
    description: pkg.description || `${pkg.name} npm package`,
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

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareSourceCode",
    name: pkg.name,
    version: pkg.version,
    description: pkg.description,
    codeRepository: pkg.repository,
    programmingLanguage: "JavaScript",
    author: pkg.author ? { "@type": "Person", name: pkg.author } : undefined,
    license: pkg.license,
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <main className="min-h-screen bg-black text-white">
        {/* Header */}
        <header className="border-b border-[#333]">
          <div className="container-page flex py-3 items-center gap-6">
            <Link href="/" className="shrink-0 hover:opacity-80 transition-opacity">
              <Image src="/logo.svg" alt="V1" width={32} height={22} />
            </Link>
            <SearchTrigger />
            <div className="flex-1" />
            <div className="flex items-center gap-4 text-xs uppercase tracking-wider shrink-0">
              <Link
                href={`https://www.npmjs.com/package/${pkg.name}`}
                target="_blank"
                className="text-[#666] hover:text-white transition-colors"
              >
                npm ↗
              </Link>
              {pkg.repository && (
                <Link
                  href={pkg.repository}
                  target="_blank"
                  className="text-[#666] hover:text-white transition-colors"
                >
                  github ↗
                </Link>
              )}
            </div>
          </div>
        </header>

        {/* Package Title Bar */}
        <div className="border-b border-[#333]">
          <div className="container-page py-6">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div>
                <h1 className="text-2xl lg:text-3xl font-bold text-white tracking-tight">
                  {pkg.name}
                </h1>
                {pkg.description && (
                  <p className="mt-2 text-sm text-[#888] max-w-2xl">{pkg.description}</p>
                )}
              </div>
              <div className="text-right">
                <div className="text-xs text-[#666] uppercase tracking-wider">version</div>
                <div className="text-lg font-bold tabular-nums">{pkg.version}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Deprecated Warning */}
        {pkg.deprecated && (
          <div className="border-b border-[#333] bg-[#111]">
            <div className="container-page py-3">
              <span className="text-xs uppercase tracking-wider text-white">deprecated</span>
              <span className="ml-3 text-sm text-[#888]">
                {pkg.deprecatedMessage || "This package is deprecated"}
              </span>
            </div>
          </div>
        )}

        {/* Install Scripts Warning */}
        {pkg.hasInstallScripts && (
          <div className="border-b border-[#333] bg-[#111]">
            <div className="container-page py-3">
              <span className="text-xs uppercase tracking-wider text-yellow-500">
                install scripts
              </span>
              <span className="ml-3 text-sm text-[#888]">
                This package runs scripts during installation (preinstall/install/postinstall)
              </span>
            </div>
          </div>
        )}

        {/* Stats Bar */}
        <div className="border-b border-[#333]">
          <div className="container-page">
            <div className="flex flex-wrap divide-x divide-[#333] -mx-4">
              <StatCell label="license" value={pkg.license || "—"} />
              <StatCell label="deps" value={String(pkg.dependencyCount)} />
              {pkg.unpackedSize && <StatCell label="size" value={formatBytes(pkg.unpackedSize)} />}
              {pkg.health ? (
                <VulnStatCellFromHealth vulns={pkg.health.security.vulnerabilities.total} />
              ) : (
                <Suspense fallback={<StatCell label="vulns" value="—" />}>
                  <VulnStatCell packageName={pkg.name} version={pkg.version} />
                </Suspense>
              )}
              <StatCell label="downloads" value={`${formatNumber(pkg.downloads)}/wk`} />
              {pkg.stars !== undefined && pkg.stars > 0 && (
                <StatCell label="stars" value={formatNumber(pkg.stars)} />
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
          <div className="border-b border-[#333] bg-[#0a1a0a]">
            <div className="container-page py-3">
              <span className="text-xs uppercase tracking-wider text-green-400">
                {pkg.health.replacement.type === "native"
                  ? "native alternative"
                  : "better alternative"}
              </span>
              {pkg.health.replacement.useInstead && (
                <span className="ml-3 text-sm text-[#888]">
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
        <div className="container-page">
          <div className="flex flex-col lg:flex-row">
            {/* Left: Main Content */}
            <div className="flex-1 min-w-0 lg:border-r border-[#333]">
              {/* Install Section */}
              <section className="border-b border-[#333] py-6 lg:pr-8">
                <InstallTabs packageName={pkg.name} hasTypes={pkg.hasTypes} />
              </section>

              {/* README Section */}
              {pkg.readmeHtml && (
                <section className="border-b border-[#333] py-6 lg:pr-8">
                  <h2 className="text-xs uppercase tracking-widest text-[#666] mb-4">readme</h2>
                  <div
                    className="readme max-w-none"
                    dangerouslySetInnerHTML={{ __html: pkg.readmeHtml }}
                  />
                </section>
              )}

              {/* Dependencies Section */}
              {deps.length > 0 && (
                <section className="py-6 lg:pr-8">
                  <h2 className="text-xs uppercase tracking-widest text-[#666] mb-4">
                    dependencies [{deps.length}]
                  </h2>
                  <div className="flex flex-wrap gap-1">
                    {deps.slice(0, 50).map((dep) => (
                      <Link
                        key={dep}
                        href={`/${encodeURIComponent(dep)}`}
                        className="text-xs px-2 py-1 border border-[#333] text-[#888] hover:text-white hover:border-white transition-colors"
                      >
                        {dep}
                      </Link>
                    ))}
                    {deps.length > 50 && (
                      <span className="text-xs px-2 py-1 text-[#444]">+{deps.length - 50}</span>
                    )}
                  </div>
                </section>
              )}
            </div>

            {/* Right: Sidebar */}
            <aside className="w-full lg:w-64 shrink-0 lg:pl-6">
              {/* Downloads with Sparkline */}
              <div className="border-b border-[#333] py-4">
                <WeeklyDownloads packageName={pkg.name} initialWeeklyDownloads={pkg.downloads} />
              </div>

              {/* Version */}
              <div className="border-b border-[#333] py-4">
                <h3 className="text-xs uppercase tracking-widest text-[#666] mb-2">latest</h3>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-white font-bold tabular-nums">{pkg.version}</span>
                  {pkg.updated > 0 && (
                    <span className="text-xs text-[#666]">
                      <TimeAgo timestamp={pkg.updated} />
                    </span>
                  )}
                </div>
              </div>

              {/* Module */}
              <div className="border-b border-[#333] py-4">
                <h3 className="text-xs uppercase tracking-widest text-[#666] mb-3">module</h3>
                <div className="flex flex-wrap gap-2">
                  {pkg.hasTypes && (
                    <span className="text-xs border border-white text-white px-2 py-0.5">TS</span>
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
                    <span className="text-xs border border-[#666] text-[#888] px-2 py-0.5">
                      ESM
                    </span>
                  )}
                  {pkg.isCJS && (
                    <span className="text-xs border border-[#666] text-[#888] px-2 py-0.5">
                      CJS
                    </span>
                  )}
                  {!pkg.hasTypes && !pkg.typesPackage && !pkg.isESM && !pkg.isCJS && (
                    <span className="text-xs text-[#444]">—</span>
                  )}
                </div>
              </div>

              {/* Health Score */}
              {pkg.health && (
                <div className="border-b border-[#333] py-4">
                  <h3 className="text-xs uppercase tracking-widest text-[#666] mb-3">
                    health score
                  </h3>
                  <div className="flex items-center gap-3">
                    <span
                      className="text-2xl font-bold"
                      style={{ color: getGradeColor(pkg.health.health.grade) }}
                    >
                      {pkg.health.health.grade}
                    </span>
                    <span className="text-sm text-[#888]">{pkg.health.health.score}/100</span>
                  </div>
                  <div className="text-xs text-[#666] mt-1">{pkg.health.health.status}</div>
                </div>
              )}

              {/* Alternatives */}
              {pkg.health?.alternatives && pkg.health.alternatives.length > 0 && (
                <div className="border-b border-[#333] py-4">
                  <h3 className="text-xs uppercase tracking-widest text-[#666] mb-3">
                    alternatives
                  </h3>
                  <div className="space-y-2">
                    {pkg.health.alternatives.slice(0, 5).map((alt) => (
                      <Link
                        key={alt.name}
                        href={`/${encodeURIComponent(alt.name)}`}
                        className="block text-sm text-[#888] hover:text-white transition-colors"
                      >
                        {alt.name}
                        <span className="text-xs text-[#666] ml-2">
                          {formatNumber(alt.downloads)}/wk
                        </span>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {/* Maintainers */}
              {pkg.maintainers && pkg.maintainers.length > 0 && (
                <div className="border-b border-[#333] py-4">
                  <h3 className="text-xs uppercase tracking-widest text-[#666] mb-3">
                    maintainers
                  </h3>
                  <div className="space-y-1">
                    {pkg.maintainers.slice(0, 5).map((m) => (
                      <Link
                        key={m}
                        href={`https://www.npmjs.com/~${m}`}
                        target="_blank"
                        className="block text-sm text-[#888] hover:text-white transition-colors"
                      >
                        ~{m}
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {/* Keywords */}
              {pkg.keywords && pkg.keywords.length > 0 && (
                <div className="border-b border-[#333] py-4">
                  <h3 className="text-xs uppercase tracking-widest text-[#666] mb-3">keywords</h3>
                  <div className="text-sm text-[#888] space-y-0.5">
                    {pkg.keywords.slice(0, 8).map((k) => (
                      <div key={k}>— {k}</div>
                    ))}
                  </div>
                </div>
              )}

              {/* Compatibility */}
              {pkg.nodeVersion && (
                <div className="border-b border-[#333] py-4">
                  <h3 className="text-xs uppercase tracking-widest text-[#666] mb-2">node</h3>
                  <div className="text-sm text-[#888]">{pkg.nodeVersion}</div>
                </div>
              )}

              {/* Links */}
              <div className="py-4">
                <h3 className="text-xs uppercase tracking-widest text-[#666] mb-3">links</h3>
                <div className="space-y-1 text-sm">
                  <Link
                    href={`https://www.npmjs.com/package/${pkg.name}`}
                    target="_blank"
                    className="block text-[#888] hover:text-white transition-colors"
                  >
                    npm ↗
                  </Link>
                  {pkg.repository && (
                    <Link
                      href={pkg.repository}
                      target="_blank"
                      className="block text-[#888] hover:text-white transition-colors"
                    >
                      {pkg.repository.includes("github") ? "github" : "repository"} ↗
                    </Link>
                  )}
                  {pkg.homepage && pkg.homepage !== pkg.repository && (
                    <Link
                      href={pkg.homepage}
                      target="_blank"
                      className="block text-[#888] hover:text-white transition-colors"
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
            </aside>
          </div>
        </div>
      </main>
    </>
  );
}

function StatCell({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex-1 min-w-[100px] px-4 py-3">
      <div className="text-[10px] uppercase tracking-widest text-[#666]">{label}</div>
      <div className="text-sm text-white font-medium tabular-nums">{value}</div>
    </div>
  );
}

function VulnStatCellFromHealth({ vulns }: { vulns: number }) {
  return (
    <div className="flex-1 min-w-[100px] px-4 py-3">
      <div className="text-[10px] uppercase tracking-widest text-[#666]">vulns</div>
      <div
        className={`text-sm font-medium tabular-nums ${vulns > 0 ? "text-red-400" : "text-white"}`}
      >
        {vulns}
      </div>
    </div>
  );
}

function HealthScoreCell({ score, grade }: { score: number; grade: string }) {
  return (
    <div className="flex-1 min-w-[100px] px-4 py-3">
      <div className="text-[10px] uppercase tracking-widest text-[#666]">health</div>
      <div className="text-sm font-medium" style={{ color: getGradeColor(grade) }}>
        {grade} ({score})
      </div>
    </div>
  );
}

function getGradeColor(grade: string): string {
  switch (grade) {
    case "A":
      return "#0fff50"; // laser green
    case "B":
      return "#39ff14"; // neon lime
    case "C":
      return "#dfff00"; // electric yellow
    case "D":
      return "#ff6700"; // blazing orange
    case "F":
      return "#ff003c"; // laser red
    default:
      return "#ffffff";
  }
}

async function VulnStatCell({ packageName, version }: { packageName: string; version: string }) {
  try {
    const res = await fetch("https://api.osv.dev/v1/query", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        package: { name: packageName, ecosystem: "npm" },
        version,
      }),
      next: { revalidate: 3600 },
    });

    if (!res.ok) return <StatCell label="vulns" value="—" />;

    const data = await res.json();
    const count = data.vulns?.length || 0;

    return (
      <div className="flex-1 min-w-[100px] px-4 py-3">
        <div className="text-[10px] uppercase tracking-widest text-[#666]">vulns</div>
        <div className="text-sm font-medium tabular-nums text-white">{count}</div>
      </div>
    );
  } catch {
    return <StatCell label="vulns" value="—" />;
  }
}
