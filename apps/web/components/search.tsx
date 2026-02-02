"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Dialog, DialogContent } from "@/components/ui/dialog";

interface SearchResult {
  name: string;
  description: string;
  version: string;
  downloads: number;
}

export function Search() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen(true);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleSearch = useCallback(async (value: string) => {
    setQuery(value);
    if (!value.trim()) {
      setResults([]);
      return;
    }

    setIsSearching(true);
    // TODO: Integrate with Typesense
    // For now, show mock results
    setTimeout(() => {
      setResults(
        [
          {
            name: "react",
            description: "React is a JavaScript library for building user interfaces.",
            version: "19.0.0",
            downloads: 58000000,
          },
          {
            name: "react-dom",
            description: "React package for working with the DOM.",
            version: "19.0.0",
            downloads: 55000000,
          },
          {
            name: "react-router",
            description: "Declarative routing for React",
            version: "7.0.0",
            downloads: 12000000,
          },
        ].filter((r) => r.name.includes(value.toLowerCase())),
      );
      setIsSearching(false);
    }, 100);
  }, []);

  const formatDownloads = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  return (
    <>
      {/* Trigger button */}
      <button
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-2 border border-border bg-secondary/50 px-3 py-2 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
      >
        <span className="text-muted-foreground">/</span>
        <span className="flex-1 text-left">search packages...</span>
        <kbd className="pointer-events-none hidden h-5 select-none items-center gap-1 border border-border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground sm:flex">
          <span className="text-xs">⌘</span>K
        </kbd>
      </button>

      {/* Search dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="overflow-hidden p-0 shadow-2xl border-border bg-popover">
          <Command className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground">
            <CommandInput
              placeholder="Search packages..."
              value={query}
              onValueChange={handleSearch}
              className="border-b border-border"
            />
            <CommandList className="max-h-[400px]">
              <CommandEmpty className="py-12 text-center text-sm text-muted-foreground">
                {isSearching ? "Searching..." : "No packages found."}
              </CommandEmpty>
              {results.length > 0 && (
                <CommandGroup heading="Packages">
                  {results.map((result) => (
                    <CommandItem
                      key={result.name}
                      value={result.name}
                      onSelect={() => {
                        setOpen(false);
                        window.location.href = `/package/${result.name}`;
                      }}
                      className="flex items-center gap-3 px-3 py-3 cursor-pointer"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-medium">{result.name}</span>
                          <span className="text-xs text-muted-foreground">v{result.version}</span>
                        </div>
                        <p className="text-sm text-muted-foreground truncate mt-0.5">
                          {result.description}
                        </p>
                      </div>
                      <div className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatDownloads(result.downloads)}/wk
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </DialogContent>
      </Dialog>
    </>
  );
}
