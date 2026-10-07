import { NextResponse } from "next/server";
import { requirePublicApiKey } from "@/app/api/public/_lib";
import { getPublicBoxById, publicBoxNotFoundMessage } from "@/lib/public-api";

type RouteProps = {
  params: Promise<{ boxId: string }>;
};

export async function GET(request: Request, { params }: RouteProps) {
  const unauthorized = requirePublicApiKey(request);
  if (unauthorized) {
    return unauthorized;
  }

  const { boxId } = await params;
  const language = new URL(request.url).searchParams.get("lang")?.trim() || undefined;
  const box = await getPublicBoxById(boxId, language);

  if (!box) {
    return NextResponse.json({ error: publicBoxNotFoundMessage(language) }, { status: 404 });
  }

  return NextResponse.json(box);
}
