import { NextResponse } from "next/server";
import { readAppSettings, writeAppSettings } from "@/lib/settings";
import type { AiProvider, AppSettings } from "@/lib/types";

function asProvider(value: string): AiProvider {
  return value === "openai" || value === "anthropic" || value === "openrouter" || value === "openwebui"
    ? value
    : "lmstudio";
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as {
      translationAi?: AppSettings["translationAi"];
      translationPrompt?: string;
    };
    const settings = await readAppSettings();

    settings.translationAi = {
      provider: asProvider(String(payload.translationAi?.provider ?? settings.translationAi.provider ?? "openrouter")),
      lmstudio: {
        ...settings.translationAi.lmstudio,
        ...(payload.translationAi?.lmstudio ?? {})
      },
      openai: {
        ...settings.translationAi.openai,
        ...(payload.translationAi?.openai ?? {})
      },
      anthropic: {
        ...settings.translationAi.anthropic,
        ...(payload.translationAi?.anthropic ?? {})
      },
      openrouter: {
        ...settings.translationAi.openrouter,
        ...(payload.translationAi?.openrouter ?? {})
      },
      openwebui: {
        ...settings.translationAi.openwebui,
        ...(payload.translationAi?.openwebui ?? {})
      }
    };
    settings.prompts.translationDraftSystemPrompt = String(
      payload.translationPrompt ?? settings.prompts.translationDraftSystemPrompt ?? ""
    ).trim();

    await writeAppSettings(settings);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not save translation AI settings." },
      { status: 500 }
    );
  }
}
