import { NextResponse } from "next/server";
import { readAppSettingsSync } from "@/lib/settings";

export function requirePublicApiKey(request: Request) {
  const expectedKey = readAppSettingsSync().security.publicApiKey?.trim() || process.env.LAGERSYSTEM_API_KEY?.trim();

  if (!expectedKey) {
    return null;
  }

  const apiKey =
    request.headers.get("x-api-key")?.trim() ||
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim() ||
    new URL(request.url).searchParams.get("key")?.trim() ||
    "";

  if (apiKey === expectedKey) {
    return null;
  }

  return NextResponse.json({ error: "Invalid or missing API key." }, { status: 401 });
}
