import { NextResponse } from "next/server";
import { requirePublicApiKey } from "@/app/api/public/_lib";

export async function GET(request: Request) {
  const unauthorized = requirePublicApiKey(request);
  if (unauthorized) {
    return unauthorized;
  }

  return NextResponse.json({
    ok: true,
    service: "lagersystem",
    date: new Date().toISOString()
  });
}
