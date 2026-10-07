import { fetchAssetOriginalResponse, fetchAssetThumbnailResponse } from "@/lib/photo-source";

export type AssetVariant = "thumbnail" | "original";

const VARIANTS = {
  thumbnail: {
    fetch: fetchAssetThumbnailResponse,
    fallbackType: "image/webp",
    cacheControl: "public, max-age=86400, stale-while-revalidate=604800",
    svg: { width: 800, height: 800, inset: 48, radius: 40, titleY: 360, titleSize: 40, labelY: 420, labelSize: 28 }
  },
  original: {
    fetch: fetchAssetOriginalResponse,
    fallbackType: "application/octet-stream",
    cacheControl: "no-store",
    svg: { width: 1200, height: 900, inset: 60, radius: 44, titleY: 410, titleSize: 54, labelY: 485, labelSize: 32 }
  }
} as const;

function escapeXml(value: string) {
  return value.replace(/[&<>"']/g, (character) => `&#${character.charCodeAt(0)};`);
}

function missingImageSvg(variant: AssetVariant, label: string) {
  const { width, height, inset, radius, titleY, titleSize, labelY, labelSize } = VARIANTS[variant].svg;
  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
    `<rect width="${width}" height="${height}" fill="#1f2422"/>`,
    `<rect x="${inset}" y="${inset}" width="${width - inset * 2}" height="${height - inset * 2}" rx="${radius}" fill="#27302d" stroke="#4b5d57" stroke-width="4"/>`,
    `<text x="${width / 2}" y="${titleY}" text-anchor="middle" font-size="${titleSize}" fill="#dfe7e2" font-family="Arial, sans-serif">Bild saknas i bildkällan</text>`,
    `<text x="${width / 2}" y="${labelY}" text-anchor="middle" font-size="${labelSize}" fill="#a9bbb3" font-family="Arial, sans-serif">${escapeXml(label)}</text>`,
    "</svg>"
  ].join("");

  return new Response(svg, {
    status: 200,
    headers: { "content-type": "image/svg+xml; charset=utf-8", "cache-control": "no-store" }
  });
}

/** Streams a photo from the photo source, or a placeholder image when the source has no such photo. */
export async function proxyAssetResponse(assetId: string, variant: AssetVariant) {
  const config = VARIANTS[variant];
  const response = await config.fetch(assetId);

  if (!response.ok) {
    return missingImageSvg(variant, assetId);
  }

  return new Response(response.body, {
    headers: {
      "content-type": response.headers.get("content-type") ?? config.fallbackType,
      "cache-control": config.cacheControl
    }
  });
}
