import { createHmac, timingSafeEqual } from "node:crypto";
import { readAppSettingsSync } from "@/lib/settings";

export type PublicAssetVariant = "thumbnail" | "original";

export function getPublicApiKey() {
  return readAppSettingsSync().security.publicApiKey?.trim() || process.env.LAGERSYSTEM_API_KEY?.trim() || "";
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

/** The key a client sent: x-api-key header, Bearer token, or ?key= (kept for old links). */
export function getRequestApiKey(request: Request) {
  return (
    request.headers.get("x-api-key")?.trim() ||
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim() ||
    new URL(request.url).searchParams.get("key")?.trim() ||
    ""
  );
}

/** True when no key is configured, or the request carries the right one. */
export function hasPublicApiAccess(request: Request, expectedKey = getPublicApiKey()) {
  return !expectedKey || safeEqual(getRequestApiKey(request), expectedKey);
}

/**
 * A signature that opens exactly one photo variant. Photo URLs in API responses carry this
 * instead of the API key, so a copied or logged URL never gives access to anything else.
 * It stays valid until the API key changes.
 */
export function signPublicAsset(assetId: string, variant: PublicAssetVariant, apiKey: string) {
  return createHmac("sha256", apiKey).update(`public-asset:${variant}:${assetId}`).digest("base64url");
}

export function hasPublicAssetAccess(request: Request, assetId: string, variant: PublicAssetVariant) {
  const expectedKey = getPublicApiKey();
  if (hasPublicApiAccess(request, expectedKey)) {
    return true;
  }

  const signature = new URL(request.url).searchParams.get("sig")?.trim() ?? "";
  return Boolean(signature) && safeEqual(signature, signPublicAsset(assetId, variant, expectedKey));
}
