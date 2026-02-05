import { OpenPanelComponent } from "@openpanel/nextjs";
import { GeistMono } from "geist/font/mono";
import type { Metadata } from "next";
import { Providers } from "@/components/providers";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://packrun.dev"),
  title: "packrun.dev - npm for agents",
  description: "MCP-first npm registry. Security signals and package health in sub-50ms, globally.",
  alternates: {
    canonical: "https://packrun.dev",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  openGraph: {
    title: "packrun.dev - npm for agents",
    description:
      "MCP-first npm registry. Security signals and package health in sub-50ms, globally.",
    url: "https://packrun.dev",
    siteName: "packrun.dev",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "packrun.dev - npm for agents",
    description:
      "MCP-first npm registry. Security signals and package health in sub-50ms, globally.",
  },
};

// WebSite schema with SearchAction for Google sitelinks search box
const websiteJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "packrun.dev",
  url: "https://packrun.dev",
  description: "MCP-first npm registry. Security signals and package health in sub-50ms, globally.",
  potentialAction: {
    "@type": "SearchAction",
    target: {
      "@type": "EntryPoint",
      urlTemplate: "https://packrun.dev/{search_term_string}",
    },
    "query-input": "required name=search_term_string",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={GeistMono.variable} suppressHydrationWarning>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
        />
      </head>
      <body className="font-mono bg-background text-foreground">
        <OpenPanelComponent
          clientId={process.env.NEXT_PUBLIC_OPENPANEL_CLIENT_ID!}
          trackScreenViews
          trackOutgoingLinks
        />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
