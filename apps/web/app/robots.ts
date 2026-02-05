import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/v1/", "/profile/"],
      },
    ],
    sitemap: "https://packrun.dev/sitemap.xml",
  };
}
