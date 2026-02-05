import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Live npm Registry Feed | packrun.dev",
  description:
    "Watch npm packages being published in real-time. A live visualization of the npm registry with packages per minute stats.",
  alternates: {
    canonical: "https://packrun.dev/updates",
  },
  openGraph: {
    title: "Live npm Registry Feed | packrun.dev",
    description: "Watch npm packages being published in real-time.",
    url: "https://packrun.dev/updates",
  },
  twitter: {
    card: "summary_large_image",
    title: "Live npm Registry Feed | packrun.dev",
    description: "Watch npm packages being published in real-time.",
  },
};

export default function UpdatesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
