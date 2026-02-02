"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useSearch } from "@/lib/hooks";
import { formatDownloads } from "@/lib/api";

export default function Home() {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [showCursor, setShowCursor] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const { data: results = [], isLoading, isFetched, debouncedQuery } = useSearch(query, 80);

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
    <main className="h-screen bg-black font-mono flex flex-col overflow-hidden relative">
      {/* Scanlines overlay */}
      <div
        className="absolute inset-0 pointer-events-none z-10 opacity-[0.012]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, transparent, transparent 1px, rgba(255,255,255,0.02) 1px, rgba(255,255,255,0.02) 2px)",
        }}
      />

      {/* Content */}
      <div className="relative z-5 h-full flex flex-col p-6 lg:p-10">
        {/* Main content - centered */}
        <div className="flex-1 flex flex-col items-center justify-center -mt-8">
          {/* Logo */}
          <Image
            src="/logo.svg"
            alt="V1"
            width={129}
            height={91}
            className="w-20 sm:w-24 lg:w-28 h-auto mb-10 select-none"
            priority
          />

          {/* Tagline */}
          <div className="text-center mb-8">
            <p className="text-xl text-neutral-200">npm, for agents</p>
            <p className="text-sm text-neutral-500 mt-2">
              So they recommend packages that are secure, maintained, and actually used
            </p>
          </div>

          {/* Command prompt with instant search */}
          <div className="w-full max-w-xl relative" ref={containerRef}>
            <form onSubmit={handleSubmit}>
              <div
                className={`flex items-center text-sm border bg-neutral-950 px-4 py-3 transition-colors ${
                  isOpen ? "border-neutral-700" : "border-neutral-800"
                }`}
              >
                <span className="text-neutral-600">$</span>
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={handleKeyDown}
                  onFocus={() => query.trim() && setIsOpen(true)}
                  className="flex-1 bg-transparent text-white ml-2 outline-none placeholder-neutral-700"
                  placeholder="search packages..."
                  spellCheck={false}
                  autoComplete="off"
                  autoCapitalize="off"
                />
                {isLoading ? (
                  <span className="text-neutral-600 text-xs">searching...</span>
                ) : (
                  <span
                    className={`w-2 h-5 bg-white transition-opacity ${showCursor && !isOpen ? "opacity-100" : "opacity-0"}`}
                  />
                )}
              </div>
            </form>

            {/* Instant search results */}
            {isOpen && query.trim() && (
              <div
                ref={resultsRef}
                className="absolute top-full left-0 right-0 mt-1 border border-neutral-800 bg-neutral-950 z-20 max-h-[280px] overflow-y-auto"
              >
                {results.length > 0 ? (
                  results.map((result, index) => (
                    <Link
                      key={result.name}
                      href={`/${encodeURIComponent(result.name)}`}
                      prefetch={true}
                      className={`flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                        index === selectedIndex
                          ? "bg-neutral-800 text-white"
                          : "text-neutral-400 hover:bg-neutral-900"
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
                            className={index === selectedIndex ? "text-white" : "text-neutral-200"}
                          >
                            {result.name}
                          </span>
                          <span className="text-neutral-600 text-xs">v{result.version}</span>
                          {result.hasTypes && (
                            <span className="text-[10px] text-blue-400 border border-blue-400/30 px-1">
                              TS
                            </span>
                          )}
                        </div>
                        {result.description && (
                          <p className="text-neutral-500 text-xs truncate mt-0.5">
                            {result.description}
                          </p>
                        )}
                      </div>
                      <div className="text-neutral-600 text-xs whitespace-nowrap">
                        {formatDownloads(result.downloads)}/wk
                      </div>
                    </Link>
                  ))
                ) : hasSearched && !isLoading ? (
                  <div className="px-4 py-6 text-center">
                    <p className="text-neutral-500 text-sm">No packages found for "{query}"</p>
                    <p className="text-neutral-600 text-xs mt-1">Press Enter to search on npm</p>
                  </div>
                ) : (
                  <div className="px-4 py-4 text-center">
                    <p className="text-neutral-600 text-sm">Searching...</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Help */}
          <div className="text-xs text-neutral-600 mt-4 text-center">
            {isOpen && results.length > 0 ? (
              <>
                <span className="text-neutral-500">↑↓</span> navigate ·{" "}
                <span className="text-neutral-500">enter</span> select ·{" "}
                <span className="text-neutral-500">esc</span> close
              </>
            ) : (
              <>
                <span className="text-neutral-500">⌘K</span> search ·{" "}
                <span className="text-neutral-500">enter</span> go · try{" "}
                <span className="text-neutral-400">react</span>,{" "}
                <span className="text-neutral-400">next</span>,{" "}
                <span className="text-neutral-400">zod</span>
              </>
            )}
          </div>
        </div>

        {/* Status line */}
        <div className="flex items-center justify-between text-xs text-neutral-600 border-t border-neutral-900 pt-3 mt-auto">
          <div className="flex items-center gap-6">
            <span>3.2M packages indexed</span>
            <span>Downloads · Types · Security · Size</span>
          </div>
          <a
            href="https://github.com"
            className="text-neutral-600 hover:text-neutral-400 transition-colors"
          >
            GITHUB
          </a>
        </div>
      </div>
    </main>
  );
}
