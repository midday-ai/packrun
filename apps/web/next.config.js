import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  transpilePackages: ["@v1/ui", "@v1/readme-renderer"],
  turbopack: {
    // Set root to monorepo root for turbo prune Docker builds
    root: resolve(__dirname, "../.."),
  },
  // Disable type checking and linting during build (handled separately in CI)
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
