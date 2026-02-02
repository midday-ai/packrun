import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Live Updates - v1.run",
  description:
    "Watch npm packages being published in real-time. A live visualization of the npm registry.",
  openGraph: {
    title: "Live Updates - v1.run",
    description: "Watch npm packages being published in real-time.",
    url: "https://v1.run/updates",
  },
  twitter: {
    card: "summary_large_image",
    title: "Live Updates - v1.run",
    description: "Watch npm packages being published in real-time.",
  },
};

export default function UpdatesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
