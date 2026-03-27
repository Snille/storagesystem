import { NextResponse } from "next/server";
import { requirePublicApiKey } from "@/app/api/public/_lib";
import { searchPublicInventory } from "@/lib/public-api";

export async function GET(request: Request) {
  const unauthorized = requirePublicApiKey(request);
  if (unauthorized) {
    return unauthorized;
  }

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim() ?? "";
  const limit = Number(searchParams.get("limit") ?? "10");

  if (!query) {
    return NextResponse.json({ error: "The q parameter is required." }, { status: 400 });
  }

  const matches = await searchPublicInventory(query, Number.isFinite(limit) ? limit : 10);
  return NextResponse.json({
    query,
    count: matches.length,
    matches
  });
}
