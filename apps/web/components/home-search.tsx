"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { TypesenseLogo } from "@/components/typesense-logo";
import { Spinner } from "@/components/ui/spinner";
import { formatDownloads } from "@/lib/api";
import { useSearch } from "@/lib/hooks";

export function HomeSearch() {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [showCursor, setShowCursor] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const { data: results = [], isLoading, isFetched, debouncedQuery } = useSearch(query, 50);

  // Blinking cursor effect
  useEffect(() => {
    const interval = setInterval(() => {
      setShowCursor((prev) => !prev);
    }, 530);
    return () => clearInterval(interval);
  }, []);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // "/" key to focus, Escape to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "/" && document.activeElement !== inputRef.current) {
        e.preventDefault();
        inputRef.current?.focus();
      }
      if (e.key === "Escape") {
        if (isOpen) {
          setIsOpen(false);
        } else if (query) {
          setQuery("");
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, query]);

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

  // Open dropdown when query changes
  useEffect(() => {
    if (query.trim()) {
      setIsOpen(true);
      setSelectedIndex(0);
    } else {
      setIsOpen(false);
    }
  }, [query]);

  // Prefetch first result
  useEffect(() => {
    if (results[0]) {
      router.prefetch(`/${encodeURIComponent(results[0].name)}`);
    }
  }, [results, router]);

  // Scroll selected item into view
  useEffect(() => {
    if (resultsRef.current && results.length > 0) {
      const selectedEl = resultsRef.current.children[selectedIndex] as HTMLElement;
      selectedEl?.scrollIntoView({ block: "nearest" });
    }
  }, [selectedIndex, results.length]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (results.length > 0) {
        const newIndex = (selectedIndex + 1) % results.length;
        setSelectedIndex(newIndex);
        if (results[newIndex]) {
          router.prefetch(`/${encodeURIComponent(results[newIndex].name)}`);
        }
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (results.length > 0) {
        const newIndex = (selectedIndex - 1 + results.length) % results.length;
        setSelectedIndex(newIndex);
        if (results[newIndex]) {
          router.prefetch(`/${encodeURIComponent(results[newIndex].name)}`);
        }
      }
    } else if (e.key === "Tab" && results.length > 0) {
      e.preventDefault();
      const newIndex = e.shiftKey
        ? (selectedIndex - 1 + results.length) % results.length
        : (selectedIndex + 1) % results.length;
      setSelectedIndex(newIndex);
      if (results[newIndex]) {
        router.prefetch(`/${encodeURIComponent(results[newIndex].name)}`);
      }
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (results.length > 0 && results[selectedIndex]) {
        clearSearch();
        router.push(`/${encodeURIComponent(results[selectedIndex].name)}`);
      } else if (query.trim()) {
        clearSearch();
        router.push(`/${encodeURIComponent(query.trim())}`);
      }
    }
  };

  const clearSearch = () => {
    setQuery("");
    setIsOpen(false);
    setSelectedIndex(0);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (results.length > 0 && results[selectedIndex]) {
      clearSearch();
      router.push(`/${encodeURIComponent(results[selectedIndex].name)}`);
    } else if (query.trim()) {
      clearSearch();
      router.push(`/${encodeURIComponent(query.trim())}`);
    }
  };

  const hasSearched = isFetched && debouncedQuery.length > 0;

  return (
    <>
      {/* Logo */}
      <Image
        src="/logo.svg"
        alt="Packrun"
        width={129}
        height={91}
        className="w-20 sm:w-24 lg:w-28 h-auto mb-10 select-none brightness-0 dark:brightness-100"
        priority
      />

      {/* Tagline */}
      <div className="text-center mb-8 mt-4">
        <h1 className="text-base text-foreground">npm for agents</h1>
        <p className="text-xs text-muted mt-2">MCP-first. Security signals. &lt;50ms globally.</p>
      </div>

      {/* Command prompt with instant search */}
      <div className="w-full max-w-xl relative px-4 sm:px-0" ref={containerRef}>
        <form onSubmit={handleSubmit}>
          <div className="flex items-center text-sm border border-border px-4 py-3">
            <span className="text-muted">$</span>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={() => query.trim() && setIsOpen(true)}
              className="flex-1 bg-transparent text-foreground ml-2 outline-none placeholder-subtle"
              placeholder="search packages..."
              spellCheck={false}
              autoComplete="off"
              autoCapitalize="off"
            />
            {isLoading ? (
              <Spinner />
            ) : (
              <span
                className={`w-2 h-5 bg-foreground transition-opacity ${showCursor && !isOpen ? "opacity-100" : "opacity-0"}`}
              />
            )}
          </div>
        </form>

        {/* Instant search results */}
        {isOpen && query.trim() && (
          <div className="absolute top-full left-0 right-0 mt-1 border border-border bg-background/95 z-20 backdrop-blur-sm flex flex-col max-h-[50vh] sm:max-h-[300px]">
            <div ref={resultsRef} className="flex-1 overflow-y-auto">
              {results.length > 0 ? (
                results.map((result, index) => (
                  <Link
                    key={result.name}
                    href={`/${encodeURIComponent(result.name)}`}
                    prefetch={true}
                    className={`flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                      index === selectedIndex
                        ? "bg-surface text-foreground"
                        : "text-muted hover:bg-surface/50"
                    }`}
                    onMouseEnter={() => {
                      setSelectedIndex(index);
                      router.prefetch(`/${encodeURIComponent(result.name)}`);
                    }}
                    onClick={() => clearSearch()}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className={
                            index === selectedIndex ? "text-foreground" : "text-foreground/80"
                          }
                        >
                          {result.name}
                        </span>
                        <span className="text-subtle text-xs">v{result.version}</span>
                        {result.hasTypes && (
                          <span className="text-[10px] text-blue-500 dark:text-blue-400 border border-blue-500/30 dark:border-blue-400/30 px-1">
                            TS
                          </span>
                        )}
                      </div>
                      {result.description && (
                        <p className="text-muted text-xs truncate mt-0.5">{result.description}</p>
                      )}
                    </div>
                    <div className="text-subtle text-xs whitespace-nowrap">
                      {formatDownloads(result.downloads)}/wk
                    </div>
                  </Link>
                ))
              ) : hasSearched && !isLoading ? (
                <div className="px-4 py-6 text-center">
                  <p className="text-muted text-sm">No packages found for "{query}"</p>
                  <p className="text-subtle text-xs mt-1">Press Enter to search on npm</p>
                </div>
              ) : (
                <div className="px-4 py-4 text-center">
                  <p className="text-subtle text-sm">Searching...</p>
                </div>
              )}
            </div>
            {/* Powered by Typesense */}
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
          </div>
        )}
      </div>

      {/* Featured packages */}
      <div className="text-xs mt-6 px-4 text-center">
        {["next", "react", "drizzle-orm", "hono", "tailwindcss", "typescript", "resend"].map(
          (pkg, i, arr) => (
            <span key={pkg}>
              <Link
                href={`/${pkg}`}
                prefetch={true}
                className="text-subtle hover:text-foreground transition-colors"
              >
                {pkg}
              </Link>
              {i < arr.length - 1 && <span className="text-faint"> · </span>}
            </span>
          ),
        )}
      </div>
    </>
  );
}
