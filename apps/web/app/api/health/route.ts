import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json(
    {
      status: "healthy",
      timestamp: new Date().toISOString(),
      region: process.env.RAILWAY_REGION || "unknown",
    },
    { status: 200 },
  );
}
