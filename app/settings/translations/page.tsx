import { TranslationsEditor } from "@/app/settings/translations/translations-editor";
import { fetchAvailableModels } from "@/lib/ai-models";
import { createTranslator, listAvailableLanguages, readLanguageCatalog } from "@/lib/i18n";
import { readAppSettings } from "@/lib/settings";
import type { AvailableModel } from "@/lib/types";

type TranslationsPageProps = {
  searchParams: Promise<{ from?: string; lang?: string }>;
};

export default async function TranslationsPage({ searchParams }: TranslationsPageProps) {
  const params = await searchParams;
  const [settings, languageOptions] = await Promise.all([readAppSettings(), listAvailableLanguages()]);
  const currentCatalog = await readLanguageCatalog(settings.appearance.language);
  const t = createTranslator(currentCatalog);
  const inheritedTranslationAi = {
    ...settings.translationAi,
    lmstudio: {
      ...settings.translationAi.lmstudio,
      apiKey: settings.translationAi.lmstudio.apiKey || settings.ai.lmstudio.apiKey
    },
    openai: {
      ...settings.translationAi.openai,
      apiKey: settings.translationAi.openai.apiKey || settings.ai.openai.apiKey
    },
    anthropic: {
      ...settings.translationAi.anthropic,
      apiKey: settings.translationAi.anthropic.apiKey || settings.ai.anthropic.apiKey
    },
    openrouter: {
      ...settings.translationAi.openrouter,
      apiKey: settings.translationAi.openrouter.apiKey || settings.ai.openrouter.apiKey
    },
    openwebui: {
      ...settings.translationAi.openwebui,
      apiKey: settings.translationAi.openwebui.apiKey || settings.ai.openwebui.apiKey
    }
  };
  const sourceCode = (() => {
    const requested = String(params.from ?? "").trim();
    if (requested && languageOptions.some((language) => language.code === requested)) {
      return requested;
    }

    return "sv";
  })();
  const targetCode = (() => {
    const requested = String(params.lang ?? "").trim();
    if (requested && requested !== sourceCode && languageOptions.some((language) => language.code === requested)) {
      return requested;
    }

    if (
      settings.appearance.language !== sourceCode &&
      languageOptions.some((language) => language.code === settings.appearance.language)
    ) {
      return settings.appearance.language;
    }

    return languageOptions.find((language) => language.code !== sourceCode)?.code ?? "en";
  })();

  const [sourceCatalog, targetCatalog] = await Promise.all([
    readLanguageCatalog(sourceCode),
    readLanguageCatalog(targetCode)
  ]);
  const sourceEntries = Object.fromEntries(
    Object.entries(sourceCatalog).filter(([key, value]) => key !== "_meta" && typeof value === "string")
  ) as Record<string, string>;
  const targetEntries = Object.fromEntries(
    Object.entries(targetCatalog).filter(([key, value]) => key !== "_meta" && typeof value === "string")
  ) as Record<string, string>;
  const translationActive =
    inheritedTranslationAi.provider === "anthropic"
      ? inheritedTranslationAi.anthropic
      : inheritedTranslationAi.provider === "openrouter"
        ? inheritedTranslationAi.openrouter
      : inheritedTranslationAi.provider === "openwebui"
        ? inheritedTranslationAi.openwebui
      : inheritedTranslationAi.provider === "openai"
        ? inheritedTranslationAi.openai
        : inheritedTranslationAi.lmstudio;
  const initialModels = await (async () => {
    try {
      return await fetchAvailableModels({
        provider: inheritedTranslationAi.provider,
        baseUrl: translationActive.baseUrl,
        apiKey: translationActive.apiKey
      });
    } catch {
      return [] as AvailableModel[];
    }
  })();
  const coverageByLanguage = Object.fromEntries(
    await Promise.all(
      languageOptions.map(async (language) => {
        const catalog = await readLanguageCatalog(language.code);
        const entries = Object.fromEntries(
          Object.entries(catalog).filter(([key, value]) => key !== "_meta" && typeof value === "string")
        ) as Record<string, string>;
        const total = Object.keys(sourceEntries).length;
        const translated = Object.keys(sourceEntries).filter((key) => (entries[key] ?? "").trim()).length;
        return [
          language.code,
          {
            translated,
            total,
            percent: total > 0 ? Math.round((translated / total) * 100) : 100
          }
        ] as const;
      })
    )
  );

  return (
    <div className="shell">
      <section className="hero">
        <h1>{t("translations.title", "Översättningar")}</h1>
        <p>{t("translations.intro", "Redigera språkfilerna per sektion, sök efter nycklar och spara bara de översättningar du vill ändra.")}</p>
      </section>

      <TranslationsEditor
        sourceCode={sourceCode}
        targetCode={targetCode}
        sourceLabel={sourceCatalog._meta.label}
        targetLabel={targetCatalog._meta.label}
        languageOptions={languageOptions}
        sourceEntries={sourceEntries}
        targetEntries={targetEntries}
        coverageByLanguage={coverageByLanguage}
        initialTranslationAi={inheritedTranslationAi}
        initialTranslationPrompt={settings.prompts.translationDraftSystemPrompt}
        initialModels={initialModels}
        ui={Object.fromEntries(
          Object.entries(currentCatalog).filter(([key, value]) => key !== "_meta" && typeof value === "string")
        ) as Record<string, string>}
      />
    </div>
  );
}
