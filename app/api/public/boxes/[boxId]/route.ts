import { NextResponse } from "next/server";
import { requirePublicApiKey } from "@/app/api/public/_lib";
import { getPublicBoxById } from "@/lib/public-api";

type RouteProps = {
  params: Promise<{ boxId: string }>;
};

export async function GET(request: Request, { params }: RouteProps) {
  const unauthorized = requirePublicApiKey(request);
  if (unauthorized) {
    return unauthorized;
  }

  const { boxId } = await params;
  const box = await getPublicBoxById(boxId);

  if (!box) {
    return NextResponse.json({ error: "Lådan kunde inte hittas." }, { status: 404 });
  }

  return NextResponse.json(box);
}
