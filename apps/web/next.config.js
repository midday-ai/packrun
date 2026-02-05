import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  transpilePackages: ["@packrun/ui", "@packrun/readme-renderer"],
  turbopack: {
    // Set root to monorepo root for turbo prune Docker builds
    root: resolve(__dirname, "../.."),
  },
  // Disable type checking and linting during build (handled separately in CI)
  typescript: {
    ignoreBuildErrors: true,
  },
  // Cache headers for Cloudflare CDN
  async headers() {
    return [
      {
        // Package pages - cache for 24 hours, serve stale for up to 24 hours while revalidating
        // On-demand revalidation handles updates immediately
        source: "/:name",
        headers: [
          {
            key: "Cache-Control",
            value: "public, s-maxage=86400, stale-while-revalidate=86400",
          },
        ],
      },
      {
        // Compare pages
        source: "/compare/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, s-maxage=3600, stale-while-revalidate=86400",
          },
        ],
      },
      {
        // Static assets - cache for 1 year (immutable)
        source: "/_next/static/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
