"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAlternatives } from "@/lib/hooks";

export function AlternativesSection({ packageName }: { packageName: string }) {
  const { data, isLoading } = useAlternatives(packageName);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Alternatives</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse h-20 bg-muted rounded" />
        </CardContent>
      </Card>
    );
  }

  if (!data || !data.alternatives || data.alternatives.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Alternatives</CardTitle>
          {data.categoryName && (
            <Link
              href={`/compare/${data.category}`}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              View all in {data.categoryName} →
            </Link>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {data.alternatives.slice(0, 5).map((alt) => (
          <Link
            key={alt.name}
            href={`/package/${alt.name}`}
            className="flex items-center justify-between py-2 px-2 -mx-2 rounded hover:bg-secondary/50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm">{alt.name}</span>
              <div className="flex gap-1">
                {alt.badges?.slice(0, 2).map((badge) => (
                  <Badge
                    key={badge}
                    variant="outline"
                    className={`text-[10px] px-1.5 py-0 h-4 ${
                      badge.includes("Declining") || badge.includes("Deprecated")
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
            </div>
            <span
              className={`font-mono text-sm ${
                (alt.score ?? 0) >= 70
                  ? "text-green-500"
                  : (alt.score ?? 0) >= 50
                    ? "text-yellow-500"
                    : "text-muted-foreground"
              }`}
            >
              {alt.score ?? 0}/100
            </span>
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}
