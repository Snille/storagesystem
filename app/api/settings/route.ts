import { NextResponse } from "next/server";
import { normalizeLabelSettings } from "@/lib/label-templates";
import { syncLmStudioLoadedModel, unloadAllLmStudioModels } from "@/lib/lmstudio-runtime";
import { readAppSettings, writeAppSettings } from "@/lib/settings";
import type {
  AppSettings,
  FontFamilyChoice,
  ThemePreference,
  AiProvider,
  ImmichAccessMode
} from "@/lib/types";

function asTheme(value: string): ThemePreference {
  return value === "light" || value === "dark" ? value : "auto";
}

function asFontFamily(value: string): FontFamilyChoice {
  return value === "georgia" || value === "verdana" || value === "trebuchet" || value === "system" ? value : "arial";
}

function asFontSizePt(value: unknown) {
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(number)) {
    return 12;
  }

  return Math.min(28, Math.max(8, number));
}

function asProvider(value: string): AiProvider {
  return value === "openai" || value === "anthropic" || value === "openrouter" || value === "openwebui"
    ? value
    : "lmstudio";
}

function asImmichAccessMode(value: string): ImmichAccessMode {
  return value === "shareKey" ? "shareKey" : "apiKey";
}

export async function POST(request: Request) {
  try {
    const previousSettings = await readAppSettings();
    const payload = (await request.json()) as AppSettings;
    const settings: AppSettings = {
      appearance: {
        theme: asTheme(String(payload.appearance?.theme ?? "auto")),
        fontFamily: asFontFamily(String(payload.appearance?.fontFamily ?? "arial")),
        fontSizePt: asFontSizePt(payload.appearance?.fontSizePt ?? 16),
        reduceMotion: Boolean(payload.appearance?.reduceMotion),
        language: String(payload.appearance?.language ?? previousSettings.appearance.language ?? "en").trim() || "en"
      },
      immich: {
        baseUrl: String(payload.immich?.baseUrl ?? "").trim(),
        accountLabel: String(payload.immich?.accountLabel ?? "").trim(),
        accessMode: asImmichAccessMode(String(payload.immich?.accessMode ?? "apiKey")),
        apiKey: String(payload.immich?.apiKey ?? "").trim(),
        shareKey: String(payload.immich?.shareKey ?? "").trim(),
        albumId: String(payload.immich?.albumId ?? "").trim()
      },
      prompts: {
        boxAnalysisInstructions: String(payload.prompts?.boxAnalysisInstructions ?? "").trim(),
        photoRolePrompt: String(payload.prompts?.photoRolePrompt ?? "").trim(),
        photoRoleSystemPrompt: String(payload.prompts?.photoRoleSystemPrompt ?? "").trim(),
        photoSummaryPrompt: String(payload.prompts?.photoSummaryPrompt ?? "").trim(),
        photoSummarySystemPrompt: String(payload.prompts?.photoSummarySystemPrompt ?? "").trim(),
        anthropicBoxSystemPrompt: String(payload.prompts?.anthropicBoxSystemPrompt ?? "").trim(),
        translationDraftSystemPrompt: String(
          payload.prompts?.translationDraftSystemPrompt ?? previousSettings.prompts.translationDraftSystemPrompt ?? ""
        ).trim(),
        summaryCleanupPrefixes: String(payload.prompts?.summaryCleanupPrefixes ?? "").trim(),
        keywordCleanupTerms: String(payload.prompts?.keywordCleanupTerms ?? "").trim(),
        notesCleanupPhrases: String(payload.prompts?.notesCleanupPhrases ?? "").trim(),
        photoSummaryCleanupPhrases: String(payload.prompts?.photoSummaryCleanupPhrases ?? "").trim()
      },
      ai: {
        provider: asProvider(String(payload.ai?.provider ?? "lmstudio")),
        lmstudio: {
          baseUrl: String(payload.ai?.lmstudio?.baseUrl ?? "").trim(),
          model: String(payload.ai?.lmstudio?.model ?? "").trim(),
          apiKey: String(payload.ai?.lmstudio?.apiKey ?? "").trim(),
          contextLength:
            typeof payload.ai?.lmstudio?.contextLength === "number" && payload.ai.lmstudio.contextLength > 0
              ? payload.ai.lmstudio.contextLength
              : undefined
        },
        openai: {
          baseUrl: String(payload.ai?.openai?.baseUrl ?? "").trim(),
          model: String(payload.ai?.openai?.model ?? "").trim(),
          apiKey: String(payload.ai?.openai?.apiKey ?? "").trim()
        },
        anthropic: {
          baseUrl: String(payload.ai?.anthropic?.baseUrl ?? "").trim(),
          model: String(payload.ai?.anthropic?.model ?? "").trim(),
          apiKey: String(payload.ai?.anthropic?.apiKey ?? "").trim()
        },
        openrouter: {
          baseUrl: String(payload.ai?.openrouter?.baseUrl ?? "").trim(),
          model: String(payload.ai?.openrouter?.model ?? "").trim(),
          apiKey: String(payload.ai?.openrouter?.apiKey ?? "").trim()
        },
        openwebui: {
          baseUrl: String(payload.ai?.openwebui?.baseUrl ?? "").trim(),
          model: String(payload.ai?.openwebui?.model ?? "").trim(),
          apiKey: String(payload.ai?.openwebui?.apiKey ?? "").trim()
        }
      },
      translationAi: {
        provider: asProvider(String(payload.translationAi?.provider ?? previousSettings.translationAi.provider ?? "openrouter")),
        lmstudio: {
          baseUrl: String(payload.translationAi?.lmstudio?.baseUrl ?? previousSettings.translationAi.lmstudio.baseUrl ?? "").trim(),
          model: String(payload.translationAi?.lmstudio?.model ?? previousSettings.translationAi.lmstudio.model ?? "").trim(),
          apiKey: String(payload.translationAi?.lmstudio?.apiKey ?? previousSettings.translationAi.lmstudio.apiKey ?? "").trim(),
          contextLength:
            typeof payload.translationAi?.lmstudio?.contextLength === "number" && payload.translationAi.lmstudio.contextLength > 0
              ? payload.translationAi.lmstudio.contextLength
              : previousSettings.translationAi.lmstudio.contextLength
        },
        openai: {
          baseUrl: String(payload.translationAi?.openai?.baseUrl ?? previousSettings.translationAi.openai.baseUrl ?? "").trim(),
          model: String(payload.translationAi?.openai?.model ?? previousSettings.translationAi.openai.model ?? "").trim(),
          apiKey: String(payload.translationAi?.openai?.apiKey ?? previousSettings.translationAi.openai.apiKey ?? "").trim()
        },
        anthropic: {
          baseUrl: String(payload.translationAi?.anthropic?.baseUrl ?? previousSettings.translationAi.anthropic.baseUrl ?? "").trim(),
          model: String(payload.translationAi?.anthropic?.model ?? previousSettings.translationAi.anthropic.model ?? "").trim(),
          apiKey: String(payload.translationAi?.anthropic?.apiKey ?? previousSettings.translationAi.anthropic.apiKey ?? "").trim()
        },
        openrouter: {
          baseUrl: String(payload.translationAi?.openrouter?.baseUrl ?? previousSettings.translationAi.openrouter.baseUrl ?? "").trim(),
          model: String(payload.translationAi?.openrouter?.model ?? previousSettings.translationAi.openrouter.model ?? "").trim(),
          apiKey: String(payload.translationAi?.openrouter?.apiKey ?? previousSettings.translationAi.openrouter.apiKey ?? "").trim()
        },
        openwebui: {
          baseUrl: String(payload.translationAi?.openwebui?.baseUrl ?? previousSettings.translationAi.openwebui.baseUrl ?? "").trim(),
          model: String(payload.translationAi?.openwebui?.model ?? previousSettings.translationAi.openwebui.model ?? "").trim(),
          apiKey: String(payload.translationAi?.openwebui?.apiKey ?? previousSettings.translationAi.openwebui.apiKey ?? "").trim()
        }
      },
      labels: normalizeLabelSettings(payload.labels ?? previousSettings.labels)
    };

    settings.labels = normalizeLabelSettings({
      ...settings.labels,
      printerQueue: String(payload.labels?.printerQueue ?? previousSettings.labels.printerQueue ?? "").trim()
    });

    await writeAppSettings(settings);

    try {
      const previousLmStudio = previousSettings.ai.lmstudio;
      const nextLmStudio = settings.ai.lmstudio;
      const switchedAwayFromLmStudio =
        previousSettings.ai.provider === "lmstudio" && settings.ai.provider !== "lmstudio";
      const switchedToDifferentLmStudioModel =
        settings.ai.provider === "lmstudio" &&
        previousSettings.ai.provider === "lmstudio" &&
        (
          previousLmStudio.baseUrl !== nextLmStudio.baseUrl ||
          previousLmStudio.model !== nextLmStudio.model ||
          previousLmStudio.apiKey !== nextLmStudio.apiKey
        );

      if (switchedAwayFromLmStudio) {
        await unloadAllLmStudioModels({
          baseUrl: previousLmStudio.baseUrl,
          apiKey: previousLmStudio.apiKey
        });
      } else if (switchedToDifferentLmStudioModel) {
        await unloadAllLmStudioModels({
          baseUrl: previousLmStudio.baseUrl,
          apiKey: previousLmStudio.apiKey
        });
      } else if (
        settings.ai.provider === "lmstudio" &&
        previousSettings.ai.provider !== "lmstudio" &&
        !nextLmStudio.model
      ) {
        await unloadAllLmStudioModels({
          baseUrl: nextLmStudio.baseUrl,
          apiKey: nextLmStudio.apiKey
        });
      } else if (
        settings.ai.provider === "lmstudio" &&
        previousSettings.ai.provider === "lmstudio" &&
        previousLmStudio.model === nextLmStudio.model &&
        previousLmStudio.baseUrl === nextLmStudio.baseUrl &&
        previousLmStudio.apiKey === nextLmStudio.apiKey &&
        nextLmStudio.model
      ) {
        await syncLmStudioLoadedModel({
          baseUrl: nextLmStudio.baseUrl,
          apiKey: nextLmStudio.apiKey,
          model: nextLmStudio.model,
          contextLength: nextLmStudio.contextLength
        });
      }
    } catch (error) {
      return NextResponse.json(
        {
          error: error instanceof Error ? error.message : "Inställningarna sparades, men LM Studio-körningen kunde inte uppdateras."
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Kunde inte spara inställningarna." },
      { status: 500 }
    );
  }
}
