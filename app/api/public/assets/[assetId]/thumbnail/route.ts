import { requirePublicAssetAccess } from "@/app/api/public/_lib";
import { proxyAssetResponse } from "@/lib/asset-proxy";

type RouteProps = {
  params: Promise<{ assetId: string }>;
};

export async function GET(request: Request, { params }: RouteProps) {
  const { assetId } = await params;
  const unauthorized = requirePublicAssetAccess(request, assetId, "thumbnail");
  if (unauthorized) {
    return unauthorized;
  }

  return proxyAssetResponse(assetId, "thumbnail");
}
