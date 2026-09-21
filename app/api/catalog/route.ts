import { NextResponse } from "next/server";
import { getCatalogSnapshot } from "@/lib/catalog-store";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(getCatalogSnapshot(), {
    headers: { "cache-control": "no-store" },
  });
}
