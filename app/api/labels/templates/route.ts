import { NextResponse } from "next/server";
import { normalizeLabelSettings } from "@/lib/label-templates";
import { readAppSettings, writeAppSettings } from "@/lib/settings";
import type { LabelSettings } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as LabelSettings;
    const settings = await readAppSettings();
    settings.labels = normalizeLabelSettings(payload);
    await writeAppSettings(settings);
    return NextResponse.json({ ok: true, labels: settings.labels });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Kunde inte spara etikettmallarna." },
      { status: 500 }
    );
  }
}
