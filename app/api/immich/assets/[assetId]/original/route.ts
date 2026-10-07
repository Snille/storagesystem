import { proxyAssetResponse } from "@/lib/asset-proxy";

type RouteProps = {
  params: Promise<{ assetId: string }>;
};

export async function GET(_request: Request, { params }: RouteProps) {
  const { assetId } = await params;
  return proxyAssetResponse(assetId, "original");
}
