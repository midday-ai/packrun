import { GeistMono } from "geist/font/mono";
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "v1.run - Fast npm package browser",
  description: "Blazing fast npm package search and documentation",
  openGraph: {
    title: "v1.run",
    description: "Blazing fast npm package search and documentation",
    url: "https://v1.run",
    siteName: "v1.run",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "v1.run",
    description: "Blazing fast npm package search and documentation",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={GeistMono.variable}>
      <body className="font-mono">{children}</body>
    </html>
  );
}
