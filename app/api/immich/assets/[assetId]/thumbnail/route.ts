import { getImmichConfig } from "@/lib/config";

type RouteProps = {
  params: Promise<{ assetId: string }>;
};

function missingImageSvg(label: string) {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="800" height="800" viewBox="0 0 800 800">
      <rect width="800" height="800" fill="#1f2422"/>
      <rect x="48" y="48" width="704" height="704" rx="40" fill="#27302d" stroke="#4b5d57" stroke-width="4"/>
      <text x="400" y="360" text-anchor="middle" font-size="40" fill="#dfe7e2" font-family="Arial, sans-serif">Bild saknas i Immich</text>
      <text x="400" y="420" text-anchor="middle" font-size="28" fill="#a9bbb3" font-family="Arial, sans-serif">${label}</text>
    </svg>
  `.trim();

  return new Response(svg, {
    status: 200,
    headers: {
      "content-type": "image/svg+xml; charset=utf-8",
      "cache-control": "no-store"
    }
  });
}

export async function GET(_request: Request, { params }: RouteProps) {
  const { assetId } = await params;
  const config = getImmichConfig();
  const query = new URLSearchParams();
  query.set("format", "WEBP");
  if (!config.apiKey && config.shareKey) {
    query.set("key", config.shareKey);
  }
  const url = `${config.baseUrl}/api/assets/${assetId}/thumbnail?${query.toString()}`;

  const response = await fetch(url, {
    headers: config.apiKey ? { "x-api-key": config.apiKey } : undefined,
    cache: "force-cache"
  });

  if (!response.ok) {
    return missingImageSvg(assetId);
  }

  return new Response(response.body, {
    headers: {
      "content-type": response.headers.get("content-type") ?? "image/webp",
      "cache-control": "public, max-age=86400, stale-while-revalidate=604800"
    }
  });
}
