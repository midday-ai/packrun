import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Profile | packrun.dev",
  description: "Manage your packrun.dev account, followed packages, and settings.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function ProfileLayout({ children }: { children: React.ReactNode }) {
  return children;
}
