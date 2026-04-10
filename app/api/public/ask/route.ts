import { NextResponse } from "next/server";
import { requirePublicApiKey } from "@/app/api/public/_lib";
import { answerInventoryQuestion } from "@/lib/public-api";
import { readAppSettings } from "@/lib/settings";

export async function POST(request: Request) {
  const unauthorized = requirePublicApiKey(request);
  if (unauthorized) {
    return unauthorized;
  }

  try {
    const payload = (await request.json()) as { query?: string };
    const query = payload.query?.trim() ?? "";

    if (!query) {
      return NextResponse.json({ error: "query is required." }, { status: 400 });
    }

    const settings = await readAppSettings();
    const language = settings.appearance.language ?? "en";
    const result = await answerInventoryQuestion(query, "public", language);
    return NextResponse.json({
      query,
      answer: result.answer,
      source: result.source,
      count: result.matches.length,
      matches: result.matches
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not process the question." },
      { status: 500 }
    );
  }
}
