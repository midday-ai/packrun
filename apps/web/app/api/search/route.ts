import { type NextRequest, NextResponse } from "next/server";
import { searchNpmPackages } from "@/lib/npm";
import { searchPackages } from "@/lib/typesense";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get("q") || "";
  const page = Number.parseInt(searchParams.get("page") || "1");
  const perPage = Math.min(
    Number.parseInt(searchParams.get("limit") || searchParams.get("perPage") || "20"),
    100,
  );

  // Optional filters
  const hasTypesParam = searchParams.get("hasTypes");
  const isESMParam = searchParams.get("isESM");
  const hasTypes = hasTypesParam !== null ? hasTypesParam === "true" : undefined;
  const isESM = isESMParam !== null ? isESMParam === "true" : undefined;

  if (!query.trim()) {
    return NextResponse.json({ hits: [], found: 0, page: 1 });
  }

  try {
    const results = await searchPackages(query, { page, perPage, hasTypes, isESM });

    // Fallback to npm search if Typesense has few results (only on page 1)
    if (results.found < 3 && page === 1) {
      const npmResults = await searchNpmPackages(query, perPage);

      // Merge results, deduplicating by name (Typesense results take priority)
      const existingNames = new Set(results.hits.map((h) => h.name));
      const newHits = npmResults.filter((r) => !existingNames.has(r.name));

      results.hits = [...results.hits, ...newHits].slice(0, perPage);
      results.found = results.hits.length;
    }

    return NextResponse.json(results);
  } catch (error) {
    console.error("Search error:", error);
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}
