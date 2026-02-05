"use client";

import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { TypesenseLogo } from "@/components/typesense-logo";
import { Command, CommandGroup, CommandItem, CommandList } from "@/components/ui/command";
import { Spinner } from "@/components/ui/spinner";
import { formatDownloads } from "@/lib/api";
import { useSearch } from "@/lib/hooks";

// Popular packages to show by default
const POPULAR_PACKAGES = [
  {
    name: "react",
    description: "React is a JavaScript library for building user interfaces.",
    version: "18.2.0",
    downloads: 25000000,
    hasTypes: true,
  },
  {
    name: "typescript",
    description: "TypeScript is a language for application scale JavaScript development.",
    version: "5.3.3",
    downloads: 52000000,
    hasTypes: true,
  },
  {
    name: "next",
    description: "The React Framework",
    version: "14.1.0",
    downloads: 6500000,
    hasTypes: true,
  },
  {
    name: "tailwindcss",
    description: "A utility-first CSS framework for rapid UI development.",
    version: "3.4.1",
    downloads: 9500000,
    hasTypes: true,
  },
  {
    name: "zod",
    description: "TypeScript-first schema declaration and validation library",
    version: "3.22.4",
    downloads: 12000000,
    hasTypes: true,
  },
  {
    name: "axios",
    description: "Promise based HTTP client for the browser and node.js",
    version: "1.6.5",
    downloads: 48000000,
    hasTypes: true,
  },
  {
    name: "lodash",
    description: "Lodash modular utilities.",
    version: "4.17.21",
    downloads: 52000000,
    hasTypes: false,
  },
  {
    name: "express",
    description: "Fast, unopinionated, minimalist web framework",
    version: "4.18.2",
    downloads: 30000000,
    hasTypes: false,
  },
  {
    name: "prisma",
    description: "Prisma is an open-source database toolkit",
    version: "5.8.1",
    downloads: 2800000,
    hasTypes: true,
  },
  {
    name: "resend",
    description: "The best API to reach humans instead of spam folders",
    version: "4.0.0",
    downloads: 500000,
    hasTypes: true,
  },
];

interface CommandSearchContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
}

const CommandSearchContext = createContext<CommandSearchContextValue | null>(null);

export function useCommandSearch() {
  const context = useContext(CommandSearchContext);
  if (!context) {
    throw new Error("useCommandSearch must be used within CommandSearchProvider");
  }
  return context;
}

export function CommandSearchProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <CommandSearchContext.Provider value={{ open, setOpen }}>
      {children}
      <CommandSearch open={open} setOpen={setOpen} />
    </CommandSearchContext.Provider>
  );
}

interface CommandSearchProps {
  open: boolean;
  setOpen: (open: boolean) => void;
}

function CommandSearch({ open, setOpen }: CommandSearchProps) {
  const [query, setQuery] = useState("");
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const { data: results = [], isLoading, isFetched, debouncedQuery } = useSearch(query, 80);

  // Keyboard shortcut: Cmd+K / Ctrl+K and Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen(!open);
      }
      if (e.key === "Escape" && open) {
        e.preventDefault();
        setOpen(false);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, setOpen]);

  // Focus input when panel opens
  useEffect(() => {
    if (open) {
      // Small delay to ensure panel is mounted
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    } else {
      // Clear query when closing
      setQuery("");
    }
  }, [open]);

  // Prefetch first result and popular packages
  useEffect(() => {
    if (results[0]) {
      router.prefetch(`/${encodeURIComponent(results[0].name)}`);
    }
    // Prefetch popular packages when showing them
    if (query.trim() === "" && POPULAR_PACKAGES.length > 0) {
      POPULAR_PACKAGES.slice(0, 3).forEach((pkg) => {
        router.prefetch(`/${encodeURIComponent(pkg.name)}`);
      });
    }
  }, [results, query, router]);

  const handleSelect = useCallback(
    (packageName: string) => {
      setOpen(false);
      setQuery("");
      router.push(`/${encodeURIComponent(packageName)}`);
    },
    [router, setOpen],
  );

  // Prefetch on hover/focus for better perceived performance
  const handleItemHover = useCallback(
    (packageName: string) => {
      router.prefetch(`/${encodeURIComponent(packageName)}`);
    },
    [router],
  );

  const handleSearch = useCallback((value: string) => {
    setQuery(value);
  }, []);

  const hasSearched = isFetched && debouncedQuery.length > 0;

  // Display items: search results or popular packages
  const displayItems = query.trim() === "" ? POPULAR_PACKAGES : results;
  const showPopular = query.trim() === "" && !isLoading;

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/50 animate-in fade-in-0 duration-200"
        onClick={() => setOpen(false)}
        aria-hidden="true"
      />

      {/* Bottom panel */}
      <div
        ref={panelRef}
        className="fixed bottom-0 left-0 right-0 z-50 transition-transform duration-150 ease-out"
        style={{
          animation: "slideUp 150ms ease-out",
        }}
      >
        <div className="bg-background border-t border-border">
          <Command className="bg-transparent" shouldFilter={false}>
            {/* Search input - terminal style */}
            <div className="border-b border-border px-6 py-4">
              <div className="flex items-center gap-3 text-sm">
                <span className="text-muted select-none">$</span>
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(e) => handleSearch(e.target.value)}
                  className="flex-1 bg-transparent text-foreground outline-none placeholder:text-subtle font-mono"
                  placeholder="search packages..."
                  spellCheck={false}
                  autoComplete="off"
                  autoCapitalize="off"
                />
                {isLoading && <Spinner />}
              </div>
            </div>

            {/* Results - responsive height */}
            <CommandList className="h-[50vh] sm:h-[320px] max-h-[320px] overflow-y-auto scrollbar-none p-2">
              {isLoading ? (
                <div className="py-12 flex items-center justify-center gap-2 text-xs text-muted">
                  <Spinner /> searching
                </div>
              ) : displayItems.length > 0 ? (
                <CommandGroup heading={showPopular ? "Popular" : undefined}>
                  {displayItems.map((item) => (
                    <CommandItem
                      key={item.name}
                      value={item.name}
                      onSelect={() => handleSelect(item.name)}
                      onMouseEnter={() => handleItemHover(item.name)}
                      className="flex items-center gap-3 px-4 py-3 cursor-pointer text-subtle data-[selected=true]:bg-foreground/5 data-[selected=true]:text-foreground rounded-none"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-foreground/90">{item.name}</span>
                          <span className="text-xs text-faint">v{item.version}</span>
                          {item.hasTypes && (
                            <span className="text-[10px] text-blue-600 dark:text-blue-400/80 border border-blue-600/20 dark:border-blue-400/20 px-1">
                              TS
                            </span>
                          )}
                        </div>
                        {item.description && (
                          <p className="text-xs text-muted truncate mt-0.5">{item.description}</p>
                        )}
                      </div>
                      <div className="text-xs text-faint whitespace-nowrap">
                        {formatDownloads(item.downloads)}/wk
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              ) : hasSearched ? (
                <div className="py-12 flex flex-col items-center justify-center">
                  <p className="text-sm text-muted">No packages found for "{query}"</p>
                  <p className="text-xs text-faint mt-1">Press Enter to search on npm</p>
                </div>
              ) : null}
            </CommandList>

            {/* Footer hint */}
            <div className="border-t border-border px-4 py-2 flex items-center justify-center text-xs text-faint">
              <span className="flex items-center gap-1.5">
                Powered by{" "}
                <a
                  href="https://typesense.org?utm_source=packrun.dev&utm_medium=referral&utm_campaign=search"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-muted hover:text-foreground transition-colors"
                >
                  <TypesenseLogo />
                </a>
              </span>
            </div>
          </Command>
        </div>
      </div>

      <style jsx>{`
        @keyframes slideUp {
          from {
            transform: translateY(100%);
          }
          to {
            transform: translateY(0);
          }
        }
      `}</style>
    </>
  );
}

// Trigger button for the header - Raycast-style pill
export function SearchTrigger({ className }: { className?: string }) {
  const { setOpen } = useCommandSearch();

  return (
    <button
      onClick={() => setOpen(true)}
      className={`inline-flex items-center gap-1.5 px-2 py-1 text-faint hover:text-muted rounded transition-colors ${className}`}
    >
      <span className="text-base">⌘</span>
      <span className="text-xs">K</span>
    </button>
  );
}
