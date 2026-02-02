import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  transpilePackages: ["@v1/ui", "@v1/readme-renderer"],
  cacheComponents: true,
  turbopack: {
    // Set root to monorepo root for turbo prune Docker builds
    root: resolve(__dirname, "../.."),
  },
};

export default nextConfig;
