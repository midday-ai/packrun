import { redirect } from "next/navigation";

// Redirect /releases to /releases/upcoming
export default function ReleasesPage() {
  redirect("/releases/upcoming");
}
