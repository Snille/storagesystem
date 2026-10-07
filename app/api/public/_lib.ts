import { NextResponse } from "next/server";
import { hasPublicApiAccess, hasPublicAssetAccess, type PublicAssetVariant } from "@/lib/public-api-auth";

function unauthorized() {
  return NextResponse.json({ error: "Invalid or missing API key." }, { status: 401 });
}

export function requirePublicApiKey(request: Request) {
  return hasPublicApiAccess(request) ? null : unauthorized();
}

/** Photo routes also accept the per-photo signature that API responses put in photo URLs. */
export function requirePublicAssetAccess(request: Request, assetId: string, variant: PublicAssetVariant) {
  return hasPublicAssetAccess(request, assetId, variant) ? null : unauthorized();
}
