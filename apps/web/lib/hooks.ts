"use client";

import { skipToken, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { orpc } from "./orpc/query";

/**
 * Search packages with debouncing
 */
export function useSearch(query: string, debounceMs = 100) {
  const [debouncedQuery, setDebouncedQuery] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), debounceMs);
    return () => clearTimeout(timer);
  }, [query, debounceMs]);

  const result = useQuery(
    orpc.search.packages.queryOptions({
      input: debouncedQuery.length > 0 ? { q: debouncedQuery, limit: 10 } : skipToken,
      staleTime: 30 * 1000,
    }),
  );

  // Transform to match old API shape for backward compatibility
  const data = result.data
    ? result.data.hits.map((hit) => ({
        name: hit.name,
        description: hit.description,
        version: hit.version,
        downloads: hit.downloads ?? 0,
        hasTypes: hit.hasTypes ?? false,
      }))
    : undefined;

  return {
    ...result,
    data,
    debouncedQuery,
  };
}

/**
 * Get alternatives for a package
 */
export function useAlternatives(packageName: string) {
  return useQuery(
    orpc.compare.getAlternatives.queryOptions({
      input: { name: packageName },
      staleTime: 5 * 60 * 1000, // 5 minutes
    }),
  );
}
