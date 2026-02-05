import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

type RevalidationType = "release" | "package";

export async function POST(request: Request) {
  try {
    const { packageName, type, secret } = (await request.json()) as {
      packageName?: string;
      type?: RevalidationType;
      secret?: string;
    };

    if (secret !== process.env.REVALIDATE_SECRET) {
      return NextResponse.json({ error: "Invalid secret" }, { status: 401 });
    }

    const paths: string[] = [];

    switch (type) {
      case "release": {
        // Revalidate releases pages and homepage
        revalidatePath("/");
        revalidatePath("/releases");
        revalidatePath("/releases/upcoming");
        revalidatePath("/releases/released");
        paths.push("/", "/releases", "/releases/upcoming", "/releases/released");

        // If package-specific release, also revalidate package page
        if (packageName) {
          revalidatePath(`/${packageName}`);
          revalidatePath(`/package/${packageName}`);
          paths.push(`/${packageName}`, `/package/${packageName}`);
        }
        break;
      }

      case "package": {
        if (!packageName) {
          return NextResponse.json({ error: "Missing packageName" }, { status: 400 });
        }
        revalidatePath(`/${packageName}`);
        revalidatePath(`/package/${packageName}`);
        paths.push(`/${packageName}`, `/package/${packageName}`);
        break;
      }

      default: {
        // Legacy support: if no type but packageName provided, treat as package
        if (packageName) {
          revalidatePath(`/${packageName}`);
          revalidatePath(`/package/${packageName}`);
          paths.push(`/${packageName}`, `/package/${packageName}`);
        } else {
          return NextResponse.json({ error: "Missing type or packageName" }, { status: 400 });
        }
      }
    }

    return NextResponse.json({ revalidated: true, paths });
  } catch (error) {
    console.error("Revalidation error:", error);
    return NextResponse.json({ error: "Revalidation failed" }, { status: 500 });
  }
}
