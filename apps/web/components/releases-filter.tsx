import Link from "next/link";

type StatusFilter = "upcoming" | "released" | "all";

interface ReleasesFilterProps {
  currentStatus: StatusFilter;
}

export function ReleasesFilter({ currentStatus }: ReleasesFilterProps) {
  return (
    <div className="flex gap-2 mb-6">
      <FilterButton href="/releases/upcoming" isActive={currentStatus === "upcoming"}>
        Upcoming
      </FilterButton>
      <FilterButton href="/releases/released" isActive={currentStatus === "released"}>
        Released
      </FilterButton>
      <FilterButton href="/releases/all" isActive={currentStatus === "all"}>
        All
      </FilterButton>
    </div>
  );
}

function FilterButton({
  href,
  isActive,
  children,
}: {
  href: string;
  isActive: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`text-xs px-3 py-1.5 border transition-colors ${
        isActive
          ? "border-foreground text-foreground"
          : "border-border text-subtle hover:text-foreground"
      }`}
    >
      {children}
    </Link>
  );
}
