import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { packageName, secret } = await request.json();

    if (secret !== process.env.REVALIDATE_SECRET) {
      return NextResponse.json({ error: "Invalid secret" }, { status: 401 });
    }

    if (!packageName) {
      return NextResponse.json({ error: "Missing packageName" }, { status: 400 });
    }

    // Revalidate both URL patterns for the package
    revalidatePath(`/${packageName}`);
    revalidatePath(`/package/${packageName}`);

    return NextResponse.json({
      revalidated: true,
      paths: [`/${packageName}`, `/package/${packageName}`],
    });
  } catch (error) {
    console.error("Revalidation error:", error);
    return NextResponse.json({ error: "Revalidation failed" }, { status: 500 });
  }
}
