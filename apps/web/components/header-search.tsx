"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

interface SearchResult {
  name: string;
  description?: string;
  version: string;
  downloads: number;
  hasTypes: boolean;
}

export function HeaderSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "/" && document.activeElement !== inputRef.current) {
        e.preventDefault();
        inputRef.current?.focus();
      }
      if (e.key === "Escape") {
        setIsOpen(false);
        inputRef.current?.blur();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Debounced search
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setSelectedIndex(0);
      setIsOpen(false);
      return;
    }

    setIsOpen(true);
    const abortController = new AbortController();
    const timeoutId = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}&limit=5`, {
          signal: abortController.signal,
        });
        if (res.ok) {
          const data = await res.json();
          setResults(data.hits || []);
          setSelectedIndex(0);
        }
      } catch (err) {
        if (err instanceof Error && err.name !== "AbortError") {
          console.error("Search error:", err);
        }
      } finally {
        setIsSearching(false);
      }
    }, 100);

    return () => {
      clearTimeout(timeoutId);
      abortController.abort();
    };
  }, [query]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown" && results.length > 0) {
      e.preventDefault();
      setSelectedIndex((i) => (i + 1) % results.length);
    } else if (e.key === "ArrowUp" && results.length > 0) {
      e.preventDefault();
      setSelectedIndex((i) => (i - 1 + results.length) % results.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (results.length > 0 && results[selectedIndex]) {
        navigateTo(results[selectedIndex].name);
      } else if (query.trim()) {
        navigateTo(query.trim());
      }
    }
  };

  const navigateTo = (name: string) => {
    setQuery("");
    setResults([]);
    setIsOpen(false);
    router.push(`/${encodeURIComponent(name)}`);
  };

  const formatDownloads = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(0)}K`;
    return num.toString();
  };

  return (
    <div className="relative" ref={containerRef}>
      <div className="flex items-center">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => query.trim() && setIsOpen(true)}
          className="w-72 lg:w-96 bg-transparent border border-[#333] px-3 py-1.5 text-sm text-white placeholder-[#666] outline-none focus:border-[#666] transition-colors"
          placeholder="Search packages..."
          spellCheck={false}
          autoComplete="off"
        />
        {isSearching && <span className="absolute right-3 text-[#666] text-xs">...</span>}
      </div>

      {/* Results dropdown */}
      {isOpen && query.trim() && (
        <div className="absolute top-full left-0 mt-2 w-full min-w-[384px] border border-[#333] bg-black z-50 max-h-[300px] overflow-y-auto">
          {results.length > 0 ? (
            results.map((result, index) => (
              <Link
                key={result.name}
                href={`/${encodeURIComponent(result.name)}`}
                className={`flex items-center justify-between px-3 py-2 text-sm transition-colors ${
                  index === selectedIndex ? "bg-[#111] text-white" : "text-[#888] hover:bg-[#111]"
                }`}
                onMouseEnter={() => setSelectedIndex(index)}
                onClick={() => {
                  setQuery("");
                  setResults([]);
                  setIsOpen(false);
                }}
              >
                <div className="min-w-0 flex-1">
                  <span className={index === selectedIndex ? "text-white" : "text-[#ccc]"}>
                    {result.name}
                  </span>
                  {result.hasTypes && (
                    <span className="ml-2 text-[10px] text-blue-400 border border-blue-400/30 px-1">
                      TS
                    </span>
                  )}
                </div>
                <span className="text-[#666] text-xs ml-2">
                  {formatDownloads(result.downloads)}/wk
                </span>
              </Link>
            ))
          ) : !isSearching ? (
            <div className="px-3 py-4 text-center text-[#666] text-sm">No packages found</div>
          ) : null}
        </div>
      )}
    </div>
  );
}
