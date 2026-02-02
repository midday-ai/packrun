"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface ComparisonData {
  category: string;
  categoryName: string;
  recommendation: string;
  smallestBundle: string;
  mostPopular: string;
  packages: Array<{
    name: string;
    score: number;
    badges: string[];
    metrics: {
      weeklyDownloads: number;
      downloadTrend: string;
      bundleSizeKb: string;
      lastCommitDays: number;
      stars: number;
      hasTypes: boolean;
      isESM: boolean;
      deprecated: boolean;
    };
  }>;
  updatedAt: string;
}

export default function CategoryPage({ params }: { params: Promise<{ category: string }> }) {
  const [category, setCategory] = useState<string>("");
  const [comparison, setComparison] = useState<ComparisonData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    params.then(({ category }) => {
      setCategory(category);
      fetch(`/api/compare?category=${category}`)
        .then((res) => {
          if (!res.ok) throw new Error("Category not found");
          return res.json();
        })
        .then(setComparison)
        .catch((e) => setError(e.message))
        .finally(() => setLoading(false));
    });
  }, [params]);

  if (loading) {
    return (
      <main className="min-h-screen">
        <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-xl">
          <div className="mx-auto flex h-14 max-w-6xl items-center px-6">
            <Link href="/" className="flex items-center gap-1.5">
              <span className="text-sm text-muted-foreground">./</span>
              <span className="font-semibold">npm</span>
            </Link>
          </div>
        </header>
        <div className="mx-auto max-w-6xl px-6 py-8">
          <div className="animate-pulse space-y-4">
            <div className="h-8 w-48 bg-muted" />
            <div className="h-64 bg-muted" />
          </div>
        </div>
      </main>
    );
  }

  if (error || !comparison) {
    return (
      <main className="min-h-screen">
        <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-xl">
          <div className="mx-auto flex h-14 max-w-6xl items-center px-6">
            <Link href="/" className="flex items-center gap-1.5">
              <span className="text-sm text-muted-foreground">./</span>
              <span className="font-semibold">npm</span>
            </Link>
          </div>
        </header>
        <div className="mx-auto max-w-6xl px-6 py-8">
          <h1 className="text-2xl font-bold mb-4">Category Not Found</h1>
          <p className="text-muted-foreground mb-4">
            The category "{category}" doesn't have a comparison yet.
          </p>
          <Link href="/compare" className="text-sm hover:underline">
            ← Back to all categories
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen">
      <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-1.5">
            <span className="text-sm text-muted-foreground">./</span>
            <span className="font-semibold">npm</span>
          </Link>
          <Link href="/compare" className="text-sm text-muted-foreground hover:text-foreground">
            ← All categories
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-6 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold mb-2">{comparison.categoryName}</h1>
          <p className="text-muted-foreground">
            {comparison.packages.length} packages compared. Scores updated automatically.
          </p>
        </div>

        {/* Summary */}
        <div className="grid md:grid-cols-3 gap-4 mb-8">
          <Card>
            <CardContent className="pt-4">
              <div className="text-sm text-muted-foreground mb-1">Recommended</div>
              <Link
                href={`/package/${comparison.recommendation}`}
                className="font-mono font-medium hover:underline"
              >
                {comparison.recommendation}
              </Link>
              <div className="text-sm text-muted-foreground mt-1">Highest overall score</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-sm text-muted-foreground mb-1">Smallest Bundle</div>
              <Link
                href={`/package/${comparison.smallestBundle}`}
                className="font-mono font-medium hover:underline"
              >
                {comparison.smallestBundle}
              </Link>
              <div className="text-sm text-muted-foreground mt-1">If size is critical</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-sm text-muted-foreground mb-1">Most Popular</div>
              <Link
                href={`/package/${comparison.mostPopular}`}
                className="font-mono font-medium hover:underline"
              >
                {comparison.mostPopular}
              </Link>
              <div className="text-sm text-muted-foreground mt-1">Most downloads</div>
            </CardContent>
          </Card>
        </div>

        {/* Packages Table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Ranked Packages</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 pr-4">Package</th>
                    <th className="text-left py-2 px-2">Score</th>
                    <th className="text-left py-2 px-2">Bundle</th>
                    <th className="text-left py-2 px-2">Downloads</th>
                    <th className="text-left py-2 px-2">Trend</th>
                    <th className="text-left py-2 px-2">Stars</th>
                    <th className="text-left py-2 px-2">Badges</th>
                  </tr>
                </thead>
                <tbody>
                  {comparison.packages.map((pkg, i) => (
                    <tr
                      key={pkg.name}
                      className={`border-b border-border/50 ${i === 0 ? "bg-secondary/30" : ""}`}
                    >
                      <td className="py-3 pr-4">
                        <Link href={`/package/${pkg.name}`} className="font-mono hover:underline">
                          {pkg.name}
                        </Link>
                        {i === 0 && (
                          <Badge variant="default" className="ml-2 text-xs">
                            Recommended
                          </Badge>
                        )}
                      </td>
                      <td className="py-3 px-2">
                        <span
                          className={`font-mono font-medium ${
                            pkg.score >= 70
                              ? "text-green-500"
                              : pkg.score >= 50
                                ? "text-yellow-500"
                                : "text-red-500"
                          }`}
                        >
                          {pkg.score}
                        </span>
                      </td>
                      <td className="py-3 px-2 font-mono text-muted-foreground">
                        {pkg.metrics.bundleSizeKb || "—"}
                      </td>
                      <td className="py-3 px-2 font-mono text-muted-foreground">
                        {formatNumber(pkg.metrics.weeklyDownloads)}
                      </td>
                      <td className="py-3 px-2">
                        <span
                          className={
                            pkg.metrics.downloadTrend === "growing"
                              ? "text-green-500"
                              : pkg.metrics.downloadTrend === "declining"
                                ? "text-red-500"
                                : "text-muted-foreground"
                          }
                        >
                          {pkg.metrics.downloadTrend === "growing"
                            ? "↑"
                            : pkg.metrics.downloadTrend === "declining"
                              ? "↓"
                              : "—"}
                        </span>
                      </td>
                      <td className="py-3 px-2 font-mono text-muted-foreground">
                        {formatNumber(pkg.metrics.stars)}
                      </td>
                      <td className="py-3 px-2">
                        <div className="flex flex-wrap gap-1">
                          {pkg.badges.slice(0, 3).map((badge) => (
                            <Badge
                              key={badge}
                              variant="outline"
                              className={`text-xs ${
                                badge.includes("Declining") ||
                                badge.includes("Security") ||
                                badge.includes("Deprecated")
                                  ? "border-red-500/30 text-red-400"
                                  : badge.includes("TypeScript") || badge.includes("Trending")
                                    ? "border-green-500/30 text-green-400"
                                    : ""
                              }`}
                            >
                              {badge}
                            </Badge>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="text-xs text-muted-foreground mt-4">
              Last updated: {new Date(comparison.updatedAt).toLocaleDateString()}
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

function formatNumber(num: number): string {
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(0)}k`;
  return String(num);
}
