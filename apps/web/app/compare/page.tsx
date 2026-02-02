import { SEED_CATEGORIES } from "@v1/decisions/categories";
import { CURATED_COMPARISONS } from "@v1/decisions/comparisons";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = {
  title: "Package Comparisons | v1.run",
  description:
    "Compare npm packages with real-time scoring. 50+ seed categories plus auto-discovered categories, all ranked by downloads, bundle size, and maintenance.",
};

export default function ComparePage() {
  // Group categories
  const popularCategories = SEED_CATEGORIES.slice(0, 12);
  const allSeedCategories = SEED_CATEGORIES;

  return (
    <main className="min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-1.5">
            <span className="text-sm text-muted-foreground">./</span>
            <span className="font-semibold">npm</span>
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-6 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold mb-2">Package Comparisons</h1>
          <p className="text-muted-foreground">
            {SEED_CATEGORIES.length}+ seed categories with automated scoring. New categories are
            discovered automatically from keyword analysis.
          </p>
        </div>

        {/* How it works */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-base">How Scoring Works</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-4 gap-4 text-sm">
              <div>
                <div className="font-medium mb-1">Downloads (20%)</div>
                <p className="text-muted-foreground">Weekly download count and trend direction</p>
              </div>
              <div>
                <div className="font-medium mb-1">Bundle Size (20%)</div>
                <p className="text-muted-foreground">Smaller gzipped size = higher score</p>
              </div>
              <div>
                <div className="font-medium mb-1">Maintenance (25%)</div>
                <p className="text-muted-foreground">Recent commits, releases, activity</p>
              </div>
              <div>
                <div className="font-medium mb-1">Quality (25%)</div>
                <p className="text-muted-foreground">TypeScript, ESM, security, community</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Dynamic categories notice */}
        <Card className="mb-8 border-dashed">
          <CardContent className="pt-4">
            <div className="flex items-start gap-3">
              <div className="text-2xl">✨</div>
              <div>
                <div className="font-medium mb-1">Auto-Discovery</div>
                <p className="text-sm text-muted-foreground">
                  Categories are discovered automatically by analyzing npm package keywords. As new
                  packages are synced, new categories may appear. Use the API to see all categories
                  including discovered ones.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Popular Categories */}
        <section className="mb-12">
          <h2 className="text-lg font-semibold mb-4">Popular Categories</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {popularCategories.map((category) => {
              const curated = CURATED_COMPARISONS.find((c) => c.category === category.id);
              return (
                <Link key={category.id} href={`/compare/${category.id}`} className="block">
                  <Card className="h-full hover:bg-secondary/50 transition-colors">
                    <CardContent className="pt-4">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium">{category.name}</span>
                        <Badge variant="outline" className="text-[10px]">
                          seed
                        </Badge>
                      </div>
                      <div className="text-sm text-muted-foreground mb-2">
                        {category.keywords.slice(0, 4).join(", ")}
                      </div>
                      {curated && (
                        <div className="flex flex-wrap gap-1">
                          {curated.packages.slice(0, 4).map((pkg) => (
                            <Badge
                              key={pkg}
                              variant={pkg === curated.recommendation ? "default" : "outline"}
                              className="text-xs"
                            >
                              {pkg}
                            </Badge>
                          ))}
                          {curated.packages.length > 4 && (
                            <Badge variant="outline" className="text-xs">
                              +{curated.packages.length - 4}
                            </Badge>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        </section>

        {/* All Seed Categories */}
        <section className="mb-12">
          <h2 className="text-lg font-semibold mb-4">
            All {SEED_CATEGORIES.length} Seed Categories
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-2">
            {allSeedCategories.map((category) => (
              <Link
                key={category.id}
                href={`/compare/${category.id}`}
                className="text-sm px-3 py-2 border border-border hover:bg-secondary/50 transition-colors"
              >
                {category.name}
              </Link>
            ))}
          </div>
        </section>

        {/* API info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Use via API / MCP</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-muted-foreground">
              Access comparisons programmatically. The API includes both seed and discovered
              categories.
            </div>
            <div className="grid gap-2 text-sm font-mono">
              <code className="bg-muted px-3 py-2">GET /api/compare?list=categories</code>
              <code className="bg-muted px-3 py-2">GET /api/compare?category=date-library</code>
              <code className="bg-muted px-3 py-2">GET /api/compare?packages=axios,got,ky</code>
              <code className="bg-muted px-3 py-2">GET /api/compare?package=moment</code>
            </div>
            <div className="text-sm text-muted-foreground">
              MCP tools: <code className="text-xs bg-muted px-1 py-0.5">compare_packages</code>,{" "}
              <code className="text-xs bg-muted px-1 py-0.5">find_alternatives</code>,{" "}
              <code className="text-xs bg-muted px-1 py-0.5">get_comparison_category</code>,{" "}
              <code className="text-xs bg-muted px-1 py-0.5">list_comparison_categories</code>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
