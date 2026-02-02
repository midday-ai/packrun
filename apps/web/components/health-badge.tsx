"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface PackageHealth {
  name: string;
  score: number;
  status: "healthy" | "stable" | "maintenance-only" | "at-risk" | "deprecated";
  signals?: {
    lastCommitAgo?: string;
    openIssues?: number;
    downloadTrend?: "growing" | "stable" | "declining";
    weeklyDownloads?: number;
    maintainerActivity?: "high" | "medium" | "low" | "none";
    stars?: number;
    deprecated?: boolean;
  };
  recommendation?: string;
  alternatives?: string[];
}

const statusConfig = {
  healthy: { label: "Healthy", color: "border-green-500/30 text-green-400" },
  stable: { label: "Stable", color: "border-blue-500/30 text-blue-400" },
  "maintenance-only": { label: "Maintenance", color: "border-yellow-500/30 text-yellow-400" },
  "at-risk": { label: "At Risk", color: "border-orange-500/30 text-orange-400" },
  deprecated: { label: "Deprecated", color: "border-red-500/30 text-red-400" },
};

export function HealthBadge({ packageName }: { packageName: string }) {
  const [health, setHealth] = useState<PackageHealth | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/package/${encodeURIComponent(packageName)}/health`)
      .then((res) => (res.ok ? res.json() : null))
      .then(setHealth)
      .catch(() => setHealth(null))
      .finally(() => setLoading(false));
  }, [packageName]);

  if (loading || !health) return null;

  const config = statusConfig[health.status];

  return (
    <Badge variant="outline" className={config.color}>
      {health.score}/100 {config.label}
    </Badge>
  );
}

export function HealthCard({ packageName }: { packageName: string }) {
  const [health, setHealth] = useState<PackageHealth | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/package/${encodeURIComponent(packageName)}/health`)
      .then((res) => (res.ok ? res.json() : null))
      .then(setHealth)
      .catch(() => setHealth(null))
      .finally(() => setLoading(false));
  }, [packageName]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Health</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse h-20 bg-muted" />
        </CardContent>
      </Card>
    );
  }

  if (!health) return null;

  const config = statusConfig[health.status];

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Health</CardTitle>
          <Badge variant="outline" className={config.color}>
            {config.label}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Score bar */}
        <div>
          <div className="flex justify-between text-sm mb-1">
            <span className="text-muted-foreground">Score</span>
            <span className="font-mono">{health.score}/100</span>
          </div>
          <div className="h-1 bg-muted overflow-hidden">
            <div
              className={`h-full transition-all ${
                health.score >= 80
                  ? "bg-green-500"
                  : health.score >= 60
                    ? "bg-blue-500"
                    : health.score >= 40
                      ? "bg-yellow-500"
                      : "bg-red-500"
              }`}
              style={{ width: `${health.score}%` }}
            />
          </div>
        </div>

        {/* Signals */}
        <div className="grid grid-cols-2 gap-3 text-sm">
          {health.signals?.lastCommitAgo && (
            <div>
              <div className="text-muted-foreground text-xs">Last commit</div>
              <div>{health.signals.lastCommitAgo}</div>
            </div>
          )}
          {health.signals?.maintainerActivity && (
            <div>
              <div className="text-muted-foreground text-xs">Activity</div>
              <div className="capitalize">{health.signals.maintainerActivity}</div>
            </div>
          )}
          {health.signals?.downloadTrend && (
            <div>
              <div className="text-muted-foreground text-xs">Downloads</div>
              <div className="capitalize">{health.signals.downloadTrend}</div>
            </div>
          )}
          {health.signals?.stars !== undefined && (
            <div>
              <div className="text-muted-foreground text-xs">Stars</div>
              <div>{health.signals.stars.toLocaleString()}</div>
            </div>
          )}
        </div>

        {/* Recommendation */}
        {health.recommendation && (
          <div className="text-sm p-2 bg-muted/50 text-muted-foreground">
            {health.recommendation}
          </div>
        )}

        {/* Alternatives */}
        {health.alternatives && health.alternatives.length > 0 && (
          <div>
            <div className="text-xs text-muted-foreground mb-1">Alternatives</div>
            <div className="flex flex-wrap gap-1">
              {health.alternatives.map((alt) => (
                <a
                  key={alt}
                  href={`/package/${alt}`}
                  className="text-xs px-2 py-0.5 bg-muted hover:bg-muted/80 transition-colors"
                >
                  {alt}
                </a>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
