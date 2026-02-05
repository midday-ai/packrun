import type { Metadata } from "next";
import Link from "next/link";
import { Footer } from "@/components/footer";
import { Header } from "@/components/header";

export const metadata: Metadata = {
  title: "Model Context Protocol (MCP) Integration | packrun.dev",
  description:
    "Give your AI agent fast, accurate npm data via MCP. Always use latest versions, check security vulnerabilities, and get comprehensive package health assessments.",
  alternates: {
    canonical: "https://packrun.dev/mcp",
  },
  openGraph: {
    title: "Model Context Protocol (MCP) Integration | packrun.dev",
    description:
      "Give your AI agent fast, accurate npm data via MCP. Always use latest versions, check security vulnerabilities, and get comprehensive package health assessments.",
    url: "https://packrun.dev/mcp",
  },
  twitter: {
    card: "summary_large_image",
    title: "Model Context Protocol (MCP) Integration | packrun.dev",
    description:
      "Give your AI agent fast, accurate npm data via MCP. Always use latest versions, check security vulnerabilities, and get comprehensive package health assessments.",
  },
};

// Cursor deeplink - config is base64 encoded JSON: {"url":"https://mcp.packrun.dev/mcp"}
// Note: Using mcp.packrun.dev subdomain to bypass Cloudflare SSE timeout
const CURSOR_DEEPLINK =
  "cursor://anysphere.cursor-deeplink/mcp/install?name=packrun&config=eyJ1cmwiOiJodHRwczovL21jcC5wYWNrcnVuLmRldi9tY3AifQ==";

export default function MCPPage() {
  return (
    <main className="min-h-screen bg-background text-foreground font-mono flex flex-col">
      <Header />

      {/* Content */}
      <div className="container-page py-12 flex-1">
        <h1 className="text-2xl font-bold mb-4">Model Context Protocol</h1>
        <p className="text-muted mb-8">
          Give your AI agent fast, accurate npm data — always use latest versions, check security
          vulnerabilities, and get comprehensive package health assessments.
        </p>

        {/* Why */}
        <section className="mb-12">
          <h2 className="text-xs uppercase tracking-widest text-subtle mb-4">Why</h2>
          <div className="space-y-3 text-sm text-muted">
            <p>
              <span className="text-foreground">Fast</span> — &lt;50ms globally
            </p>
            <p>
              <span className="text-foreground">Accurate</span> — Real-time version data, no
              hallucinated packages
            </p>
            <p>
              <span className="text-foreground">Secure</span> — Vulnerability data from OSV for
              every package
            </p>
            <p>
              <span className="text-foreground">Current</span> — Synced with npm registry, always up
              to date
            </p>
          </div>
        </section>

        {/* Installation */}
        <section className="mb-12">
          <h2 className="text-xs uppercase tracking-widest text-subtle mb-4">Configuration</h2>

          {/* Cursor deeplink */}
          <div className="mb-6">
            <Link
              href={CURSOR_DEEPLINK}
              className="inline-flex items-center gap-2.5 px-4 py-2.5 bg-surface border border-border rounded-lg text-sm text-foreground hover:border-subtle transition-colors"
            >
              {/* Cursor logo icon */}
              <svg
                width="18"
                height="18"
                viewBox="0 0 130 145"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  fill="currentColor"
                  d="M 60.66 0.00 L 64.42 0.00 C 82.67 10.62 100.99 21.12 119.25 31.72 C 121.24 33.01 123.54 34.18 124.72 36.34 C 125.34 39.17 125.06 42.10 125.11 44.98 C 125.07 63.63 125.08 82.28 125.11 100.93 C 125.07 102.84 125.14 104.79 124.73 106.68 C 123.53 108.54 121.50 109.62 119.68 110.77 C 104.03 119.72 88.45 128.80 72.85 137.83 C 69.53 139.68 66.36 141.91 62.74 143.17 C 60.51 142.85 58.57 141.57 56.62 140.54 C 40.81 131.22 24.82 122.22 9.00 112.92 C 5.85 111.16 2.79 109.23 0.00 106.93 L 0.00 36.10 C 3.83 32.32 8.81 30.12 13.34 27.33 C 29.10 18.19 44.82 8.98 60.66 0.00 M 5.62 38.04 C 8.28 40.64 11.88 41.83 14.96 43.80 C 30.60 53.06 46.50 61.89 62.05 71.30 C 62.86 75.82 62.50 80.43 62.55 85.00 C 62.57 100.64 62.51 116.29 62.54 131.93 C 62.54 133.69 62.72 135.44 63.01 137.17 C 64.18 135.60 65.29 133.98 66.24 132.27 C 83.07 103.08 99.93 73.92 116.65 44.67 C 117.89 42.62 118.84 40.42 119.57 38.14 C 113.41 37.65 107.23 37.91 101.06 37.87 C 73.71 37.85 46.35 37.85 18.99 37.87 C 14.54 38.02 10.07 37.53 5.62 38.04 Z"
                />
              </svg>
              Add to Cursor
            </Link>
          </div>

          <p className="text-sm text-muted mb-4">
            Or manually add to <code className="text-foreground">.cursor/mcp.json</code>:
          </p>
          <div className="bg-surface border border-border p-4 overflow-x-auto">
            <pre className="text-sm text-muted">
              {`{
  "mcpServers": {
    "packrun": {
      "url": "https://mcp.packrun.dev/mcp"
    }
  }
}`}
            </pre>
          </div>
        </section>

        {/* Available Tools */}
        <section className="mb-12">
          <h2 className="text-xs uppercase tracking-widest text-subtle mb-4">Tools</h2>

          {/* Version Intelligence Tools */}
          <div className="mb-6">
            <h3 className="text-sm font-medium text-foreground mb-3">Version Intelligence</h3>
            <div className="space-y-4">
              <div className="border border-border p-4">
                <h4 className="text-foreground font-medium mb-2">get_latest_with_health</h4>
                <p className="text-sm text-muted">
                  Always get the latest version with comprehensive health check, security status,
                  and safety assessment. Ensures you're using the best version.
                </p>
              </div>
              <div className="border border-border p-4">
                <h4 className="text-foreground font-medium mb-2">check_version_health</h4>
                <p className="text-sm text-muted">
                  Check if a specific package version is latest, secure, and well-maintained.
                  Compares current version against latest with upgrade recommendations.
                </p>
              </div>
              <div className="border border-border p-4">
                <h4 className="text-foreground font-medium mb-2">audit_outdated_packages</h4>
                <p className="text-sm text-muted">
                  Analyze package.json to find outdated packages, security vulnerabilities, and
                  prioritize upgrades. Returns comprehensive audit with actionable recommendations.
                </p>
              </div>
              <div className="border border-border p-4">
                <h4 className="text-foreground font-medium mb-2">suggest_latest_for_category</h4>
                <p className="text-sm text-muted">
                  Get latest versions of top packages in a category with health scores and
                  recommendations. Always returns latest versions with safety assessment.
                </p>
              </div>
            </div>
          </div>

          {/* Package Analysis Tools */}
          <div className="mb-6">
            <h3 className="text-sm font-medium text-foreground mb-3">Package Analysis</h3>
            <div className="space-y-4">
              <div className="border border-border p-4">
                <h4 className="text-foreground font-medium mb-2">get_package_health</h4>
                <p className="text-sm text-muted">
                  Comprehensive package health assessment including security, quality,
                  compatibility, popularity, alternatives, and AI recommendations.
                </p>
              </div>
              <div className="border border-border p-4">
                <h4 className="text-foreground font-medium mb-2">compare_packages</h4>
                <p className="text-sm text-muted">
                  Side-by-side comparison of multiple packages (health, security, popularity, types,
                  ESM support).
                </p>
              </div>
              <div className="border border-border p-4">
                <h4 className="text-foreground font-medium mb-2">find_alternatives</h4>
                <p className="text-sm text-muted">
                  Find alternative packages with recommendations for deprecated or outdated
                  packages.
                </p>
              </div>
              <div className="border border-border p-4">
                <h4 className="text-foreground font-medium mb-2">check_vulnerabilities</h4>
                <p className="text-sm text-muted">
                  Check for known security vulnerabilities in a package version using OSV database.
                </p>
              </div>
              <div className="border border-border p-4">
                <h4 className="text-foreground font-medium mb-2">check_deprecated</h4>
                <p className="text-sm text-muted">
                  Check if a package is deprecated and get recommended alternatives.
                </p>
              </div>
              <div className="border border-border p-4">
                <h4 className="text-foreground font-medium mb-2">check_types</h4>
                <p className="text-sm text-muted">
                  Check if a package has TypeScript types (bundled or via @types package).
                </p>
              </div>
              <div className="border border-border p-4">
                <h4 className="text-foreground font-medium mb-2">get_package_version</h4>
                <p className="text-sm text-muted">Get the latest version of an npm package.</p>
              </div>
            </div>
          </div>
        </section>

        {/* Links */}
        <section>
          <h2 className="text-xs uppercase tracking-widest text-subtle mb-4">Links</h2>
          <div className="space-y-2 text-sm">
            <Link
              href="https://mcp.packrun.dev/mcp"
              target="_blank"
              className="block text-muted hover:text-foreground transition-colors"
            >
              MCP Endpoint ↗
            </Link>
            <Link
              href="https://modelcontextprotocol.io"
              target="_blank"
              className="block text-muted hover:text-foreground transition-colors"
            >
              MCP Documentation ↗
            </Link>
          </div>
        </section>
      </div>

      <Footer />
    </main>
  );
}
