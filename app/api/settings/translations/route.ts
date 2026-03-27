import { NextResponse } from "next/server";
import { listAvailableLanguages, readLanguageCatalog, writeLanguageCatalog } from "@/lib/i18n";

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as {
      code?: string;
      entries?: Record<string, string>;
      meta?: {
        label?: string;
        htmlLang?: string;
        speechRecognitionLocale?: string;
      };
    };

    const code = String(payload.code ?? "").trim();
    if (!code) {
      return NextResponse.json({ error: "Language code is required." }, { status: 400 });
    }

    const availableLanguages = await listAvailableLanguages();
    const languageExists = availableLanguages.some((language) => language.code === code);
    if (!languageExists && !payload.meta) {
      return NextResponse.json({ error: "Unknown language." }, { status: 400 });
    }

    const sourceCatalog = await readLanguageCatalog("sv");
    const currentCatalog = await readLanguageCatalog(code);
    const nextEntries = Object.fromEntries(
      Object.entries(sourceCatalog)
        .filter(([key, value]) => key !== "_meta" && typeof value === "string")
        .map(([key]) => [key, String(payload.entries?.[key] ?? currentCatalog[key] ?? "")])
    );

    await writeLanguageCatalog(
      code,
      nextEntries,
      payload.meta
        ? {
            code,
            label: String(payload.meta.label ?? code).trim() || code,
            htmlLang: String(payload.meta.htmlLang ?? code).trim() || code,
            speechRecognitionLocale: String(payload.meta.speechRecognitionLocale ?? code).trim() || code
          }
        : undefined
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not save translations." },
      { status: 500 }
    );
  }
}
