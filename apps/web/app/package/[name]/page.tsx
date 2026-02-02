import { redirect } from "next/navigation";

interface PageProps {
  params: Promise<{ name: string }>;
}

// Redirect /package/[name] to /[name]
export default async function PackageRedirect({ params }: PageProps) {
  const { name } = await params;
  redirect(`/${name}`);
}
