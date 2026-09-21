import { NextResponse } from "next/server";
import { getOverview } from "@/lib/catalog-store";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(await getOverview(), {
      headers: { "cache-control": "no-store" },
    });
  } catch (error) {
    console.error("Unable to load overview", error);
    return NextResponse.json(
      {
        error:
          "Catalog storage is unavailable. Check the database and object storage settings.",
      },
      { status: 503 },
    );
  }
}
