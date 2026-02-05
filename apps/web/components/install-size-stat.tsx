"use client";

import { useQuery } from "@tanstack/react-query";
import { Spinner } from "@/components/ui/spinner";
import { orpc } from "@/lib/orpc/query";
import { formatBytes } from "@/lib/packages";

interface InstallSizeStatCellProps {
  name: string;
  version: string;
  unpackedSize?: number;
}

/** Client cache: 7 days (matches Cloudflare s-maxage) */
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const STALE_TIME_MS = SEVEN_DAYS_MS;
const GC_TIME_MS = SEVEN_DAYS_MS;

/**
 * Install Size stat: "X MB / Y MB" (package unpacked / total including deps).
 * First number from health (unpackedSize); second number from API via React Query.
 */
export function InstallSizeStatCell({ name, version, unpackedSize }: InstallSizeStatCellProps) {
  const { data, isPending } = useQuery(
    orpc.package.getInstallSize.queryOptions({
      input: { name, version },
      staleTime: STALE_TIME_MS,
      gcTime: GC_TIME_MS,
    }),
  );

  const first = unpackedSize != null ? formatBytes(unpackedSize) : "—";

  return (
    <div
      className="flex-1 min-w-[200px] sm:min-w-[220px] shrink-0 px-3 py-3"
      title="Package size / Total install size (including dependencies)"
    >
      <div className="text-[10px] uppercase tracking-widest text-subtle">Install Size</div>
      <div className="text-sm font-medium tabular-nums text-foreground flex items-center flex-nowrap gap-x-1.5 whitespace-nowrap">
        <span>{first}</span>
        <span className="text-subtle">/</span>
        {isPending ? (
          <span className="inline-flex items-center text-subtle">
            <Spinner className="text-subtle" />
          </span>
        ) : (
          <span>{data?.totalSize != null ? formatBytes(data.totalSize) : "—"}</span>
        )}
      </div>
    </div>
  );
}
