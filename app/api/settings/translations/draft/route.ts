import { NextResponse } from "next/server";
import { buildTranslationDraft } from "@/lib/translation-draft";
import { readLanguageCatalog } from "@/lib/i18n";

function detectSection(key: string) {
  return key.split(".")[0] ?? "misc";
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as {
      sourceCode?: string;
      targetCode?: string;
      section?: string;
    };

    const sourceCode = String(payload.sourceCode ?? "").trim();
    const targetCode = String(payload.targetCode ?? "").trim();
    const section = String(payload.section ?? "all").trim();

    if (!sourceCode || !targetCode) {
      return NextResponse.json({ error: "Source and target languages are required." }, { status: 400 });
    }

    if (sourceCode === targetCode) {
      return NextResponse.json({ error: "Source and target language must differ." }, { status: 400 });
    }

    const [sourceCatalog, targetCatalog] = await Promise.all([
      readLanguageCatalog(sourceCode),
      readLanguageCatalog(targetCode)
    ]);

    const sourceEntries = Object.fromEntries(
      Object.entries(sourceCatalog).filter(([key, value]) => {
        if (key === "_meta" || typeof value !== "string") {
          return false;
        }

        return section === "all" ? true : detectSection(key) === section;
      })
    ) as Record<string, string>;

    const targetEntries = Object.fromEntries(
      Object.entries(targetCatalog).filter(([key, value]) => key !== "_meta" && typeof value === "string")
    ) as Record<string, string>;

    const draft = await buildTranslationDraft({
      sourceCode,
      targetCode,
      section,
      sourceEntries,
      existingTargetEntries: targetEntries
    });

    return NextResponse.json({ ok: true, entries: draft.entries, count: draft.count });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not build translation draft." },
      { status: 500 }
    );
  }
}
