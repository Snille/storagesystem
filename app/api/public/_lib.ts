import { NextResponse } from "next/server";

export function requirePublicApiKey(request: Request) {
  const expectedKey = process.env.LAGERSYSTEM_API_KEY?.trim();

  if (!expectedKey) {
    return null;
  }

  const apiKey =
    request.headers.get("x-api-key")?.trim() ||
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim() ||
    "";

  if (apiKey === expectedKey) {
    return null;
  }

  return NextResponse.json({ error: "Invalid or missing API key." }, { status: 401 });
}
