import { SettingsForm } from "@/app/settings/settings-form";
import { fetchAvailableModels } from "@/lib/ai-models";
import { listAvailablePrinterQueues } from "@/lib/cups-printers";
import { fetchAvailableAlbums } from "@/lib/immich-albums";
import { createTranslator, listAvailableLanguages } from "@/lib/i18n";
import { readResolvedLanguageCatalog } from "@/lib/request-language";
import { getDefaultAppSettings, readAppSettings } from "@/lib/settings";
import type { AvailableAlbum, AvailableModel, AvailablePrinter } from "@/lib/types";

async function readInitialModels() {
  const settings = await readAppSettings();
  const active =
    settings.ai.provider === "anthropic"
      ? settings.ai.anthropic
      : settings.ai.provider === "openrouter"
        ? settings.ai.openrouter
      : settings.ai.provider === "openwebui"
        ? settings.ai.openwebui
      : settings.ai.provider === "openai"
        ? settings.ai.openai
        : settings.ai.lmstudio;

  try {
    return await fetchAvailableModels({
      provider: settings.ai.provider,
      baseUrl: active.baseUrl,
      apiKey: active.apiKey
    });
  } catch {
    return [] as AvailableModel[];
  }
}

async function readInitialAlbums() {
  const settings = await readAppSettings();

  try {
    return await fetchAvailableAlbums({
      provider: settings.immich.provider,
      baseUrl: settings.immich.baseUrl,
      accessMode: settings.immich.accessMode,
      apiKey: settings.immich.apiKey,
      shareKey: settings.immich.shareKey,
      currentAlbumId: settings.immich.albumId
    });
  } catch {
    return [] as AvailableAlbum[];
  }
}

async function readInitialPrinters() {
  try {
    const printers = await listAvailablePrinterQueues();
    return printers satisfies AvailablePrinter[];
  } catch {
    return [] as AvailablePrinter[];
  }
}

export default async function SettingsPage() {
  const [settings, availableModels, availableAlbums, availablePrinters, languageOptions] = await Promise.all([
    readAppSettings(),
    readInitialModels(),
    readInitialAlbums(),
    readInitialPrinters(),
    listAvailableLanguages()
  ]);
  const languageCatalog = await readResolvedLanguageCatalog(settings.appearance.language);
  const t = createTranslator(languageCatalog);

  return (
    <div className="shell">
      <section className="hero">
        <h1>{t("settings.title", "Inställningar")}</h1>
        <p>{t("settings.intro", "Här styr du utseende, typografi och vilken AI-motor appen ska använda för bildanalys.")}</p>
      </section>

      <SettingsForm
        initialSettings={settings}
        defaultPrompts={getDefaultAppSettings().prompts}
        initialModels={availableModels}
        initialAlbums={availableAlbums}
        initialPrinters={availablePrinters}
        languageOptions={languageOptions}
        ui={Object.fromEntries(
          Object.entries(languageCatalog).filter(([key, value]) => key !== "_meta" && typeof value === "string")
        ) as Record<string, string>}
      />
    </div>
  );
}
