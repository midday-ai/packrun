import type { MetadataRoute } from "next";
import { POPULAR_PACKAGES } from "@/lib/popular-packages";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = "https://packrun.dev";

  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${baseUrl}/mcp`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/updates`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.7,
    },
  ];

  // Package pages
  const packagePages: MetadataRoute.Sitemap = POPULAR_PACKAGES.map((pkg) => ({
    url: `${baseUrl}/${encodeURIComponent(pkg)}`,
    lastModified: new Date(),
    changeFrequency: "daily" as const,
    priority: 0.9,
  }));

  return [...staticPages, ...packagePages];
}
