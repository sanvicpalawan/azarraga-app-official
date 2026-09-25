import { NextResponse } from "next/server";
import { getCatalogSnapshot } from "@/lib/catalog-store";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json(
      { connected: false, storage: "unconfigured" },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }
  try {
    await getCatalogSnapshot();
    return NextResponse.json(
      { connected: true, storage: "postgres" },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    console.error("Storage health check failed", error);
    return NextResponse.json(
      { connected: false, storage: "postgres" },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }
}
