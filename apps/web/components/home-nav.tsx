"use client";

import Link from "next/link";
import { useCommandSearch } from "@/components/command-search";

export function HomeNav() {
  const { setOpen } = useCommandSearch();

  return (
    <nav className="flex items-center justify-center gap-4 text-xs text-subtle">
      <Link href="/releases/upcoming" className="hover:text-foreground transition-colors">
        Releases
      </Link>
      <span className="text-faint">·</span>
      <Link href="/mcp" className="hover:text-foreground transition-colors">
        MCP
      </Link>
      <span className="text-faint">·</span>
      <Link href="/updates" className="hover:text-foreground transition-colors">
        Live
      </Link>
      <span className="text-faint">·</span>
      <Link
        href="https://api.packrun.dev/docs"
        target="_blank"
        className="hover:text-foreground transition-colors"
      >
        API
      </Link>
      <span className="text-faint">·</span>
      <button onClick={() => setOpen(true)} className="hover:text-foreground transition-colors">
        Search <span className="text-faint">(⌘K)</span>
      </button>
    </nav>
  );
}
