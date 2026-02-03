import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Profile | v1.run",
  description: "Manage your v1.run account, favorite packages, and settings.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function ProfileLayout({ children }: { children: React.ReactNode }) {
  return children;
}
