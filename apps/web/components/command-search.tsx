"use client";

import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import {
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useSearch } from "@/lib/hooks";
import { formatDownloads } from "@/lib/api";

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
    name: "vite",
    description: "Next Generation Frontend Tooling",
    version: "5.0.12",
    downloads: 14000000,
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

  const { data: results = [], isLoading, isFetched, debouncedQuery } = useSearch(query, 80);

  // Keyboard shortcut: Cmd+K / Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen(!open);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, setOpen]);

  // Focus input when dialog opens
  useEffect(() => {
    if (open) {
      // Small delay to ensure dialog is mounted
      setTimeout(() => {
        inputRef.current?.focus();
      }, 0);
    } else {
      // Clear query when closing
      setQuery("");
    }
  }, [open]);

  // Prefetch first result
  useEffect(() => {
    if (results[0]) {
      router.prefetch(`/${encodeURIComponent(results[0].name)}`);
    }
  }, [results, router]);

  const handleSelect = useCallback(
    (packageName: string) => {
      setOpen(false);
      setQuery("");
      router.push(`/${encodeURIComponent(packageName)}`);
    },
    [router, setOpen],
  );

  const handleSearch = useCallback((value: string) => {
    setQuery(value);
  }, []);

  const hasSearched = isFetched && debouncedQuery.length > 0;

  // Display items: search results or popular packages
  const displayItems = query.trim() === "" ? POPULAR_PACKAGES : results;
  const showPopular = query.trim() === "" && !isLoading;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogHeader className="sr-only">
        <DialogTitle>Search packages</DialogTitle>
      </DialogHeader>
      <DialogContent
        className="bg-transparent! overflow-hidden p-0 border-0 shadow-2xl max-w-xl"
        showCloseButton={false}
      >
        {/* Frosted glass container */}
        <div className="overflow-hidden backdrop-blur-lg bg-[rgba(19,19,19,0.7)] border border-white/10">
          <Command className="bg-transparent" shouldFilter={false}>
            <CommandInput
              ref={inputRef}
              placeholder="Search packages..."
              value={query}
              onValueChange={handleSearch}
              className="h-12 text-white placeholder:text-[#555] bg-transparent border-0"
            />
            <CommandList className="h-[400px] max-h-none overflow-y-auto scrollbar-none">
              {isLoading ? (
                <div className="py-12 flex items-center justify-center text-sm text-[#555]">
                  Searching...
                </div>
              ) : displayItems.length > 0 ? (
                <CommandGroup heading={showPopular ? "Popular" : undefined}>
                  {displayItems.map((item) => (
                    <CommandItem
                      key={item.name}
                      value={item.name}
                      onSelect={() => handleSelect(item.name)}
                      className="flex items-center gap-3 px-4 py-3 cursor-pointer text-[#666] data-[selected=true]:bg-white/5 data-[selected=true]:text-white"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-[#ccc]">{item.name}</span>
                          <span className="text-xs text-[#444]">v{item.version}</span>
                          {item.hasTypes && (
                            <span className="text-[10px] text-blue-400/80 border border-blue-400/20 px-1">
                              TS
                            </span>
                          )}
                        </div>
                        {item.description && (
                          <p className="text-xs text-[#555] truncate mt-0.5">{item.description}</p>
                        )}
                      </div>
                      <div className="text-xs text-[#444] whitespace-nowrap">
                        {formatDownloads(item.downloads)}/wk
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              ) : hasSearched ? (
                <div className="py-12 flex flex-col items-center justify-center">
                  <p className="text-sm text-[#555]">No packages found for "{query}"</p>
                  <p className="text-xs text-[#444] mt-1">Press Enter to search on npm</p>
                </div>
              ) : null}
            </CommandList>
          </Command>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Trigger button for the header
export function SearchTrigger({ className }: { className?: string }) {
  const { setOpen } = useCommandSearch();

  return (
    <button
      onClick={() => setOpen(true)}
      className={`text-xs text-[#666] hover:text-[#888] transition-colors ${className}`}
    >
      /search
    </button>
  );
}
