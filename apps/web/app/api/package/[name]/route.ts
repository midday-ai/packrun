import { type NextRequest, NextResponse } from "next/server";
import {
  getAuthorName,
  getDownloads,
  getLatestVersion,
  getPackage,
  getRepoUrl,
  hasTypes,
  isCJS,
  isESM,
} from "@/lib/npm";

export async function GET(request: NextRequest, { params }: { params: Promise<{ name: string }> }) {
  try {
    const { name } = await params;
    const decodedName = decodeURIComponent(name);

    const [pkg, downloads] = await Promise.all([
      getPackage(decodedName),
      getDownloads(decodedName),
    ]);

    if (!pkg) {
      return NextResponse.json({ error: "Package not found" }, { status: 404 });
    }

    const version = getLatestVersion(pkg);
    const versionData = pkg.versions?.[version];

    return NextResponse.json({
      name: pkg.name,
      version,
      description: pkg.description,
      deprecated: Boolean(pkg.deprecated),
      types: hasTypes(pkg),
      esm: isESM(pkg),
      cjs: isCJS(pkg),
      nodeVersion: versionData?.engines?.node || null,
      peerDependencies: versionData?.peerDependencies || {},
      dependencies: versionData?.dependencies || {},
      license: pkg.license || null,
      author: getAuthorName(pkg),
      repository: getRepoUrl(pkg),
      homepage: pkg.homepage || null,
      downloads: downloads?.downloads || 0,
      install: `npm install ${pkg.name}`,
    });
  } catch (error) {
    console.error("Package API error:", error);
    return NextResponse.json({ error: "Failed to fetch package" }, { status: 500 });
  }
}
