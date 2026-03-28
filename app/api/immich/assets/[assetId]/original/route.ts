import { fetchAssetOriginalResponse } from "@/lib/photo-source";

type RouteProps = {
  params: Promise<{ assetId: string }>;
};

function missingImageSvg(label: string) {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="1200" height="900" viewBox="0 0 1200 900">
      <rect width="1200" height="900" fill="#1f2422"/>
      <rect x="60" y="60" width="1080" height="780" rx="44" fill="#27302d" stroke="#4b5d57" stroke-width="4"/>
      <text x="600" y="410" text-anchor="middle" font-size="54" fill="#dfe7e2" font-family="Arial, sans-serif">Bild saknas i Immich</text>
      <text x="600" y="485" text-anchor="middle" font-size="32" fill="#a9bbb3" font-family="Arial, sans-serif">${label}</text>
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
  const response = await fetchAssetOriginalResponse(assetId);

  if (!response.ok) {
    return missingImageSvg(assetId);
  }

  return new Response(response.body, {
    headers: {
      "content-type": response.headers.get("content-type") ?? "application/octet-stream",
      "cache-control": "no-store"
    }
  });
}
