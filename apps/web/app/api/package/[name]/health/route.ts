import { type NextRequest, NextResponse } from "next/server";
import { fetchPackageHealth } from "@/lib/health";

export async function GET(request: NextRequest, { params }: { params: Promise<{ name: string }> }) {
  try {
    const { name } = await params;
    const decodedName = decodeURIComponent(name);

    const health = await fetchPackageHealth(decodedName);

    if (!health) {
      return NextResponse.json(
        { error: "Package not found or health data unavailable" },
        { status: 404 },
      );
    }

    return NextResponse.json(health, {
      headers: {
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
      },
    });
  } catch (error) {
    console.error("Health API error:", error);
    return NextResponse.json({ error: "Failed to fetch health data" }, { status: 500 });
  }
}
