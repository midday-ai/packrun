/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@v1/ui", "@v1/readme-renderer"],
  cacheComponents: true,
};

export default nextConfig;
