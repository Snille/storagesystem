import { SettingsForm } from "@/app/settings/settings-form";
import { fetchAvailableModels } from "@/lib/ai-models";
import { fetchAvailableAlbums } from "@/lib/immich-albums";
import { readAppSettings } from "@/lib/settings";
import type { AvailableAlbum, AvailableModel } from "@/lib/types";

async function readInitialModels() {
  const settings = await readAppSettings();
  const active =
    settings.ai.provider === "anthropic"
      ? settings.ai.anthropic
      : settings.ai.provider === "openrouter"
        ? settings.ai.openrouter
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

export default async function SettingsPage() {
  const [settings, availableModels, availableAlbums] = await Promise.all([
    readAppSettings(),
    readInitialModels(),
    readInitialAlbums()
  ]);

  return (
    <div className="shell">
      <section className="hero">
        <h1>Inställningar</h1>
        <p>
          Här styr du utseende, typografi och vilken AI-motor appen ska använda för bildanalys.
        </p>
      </section>

      <SettingsForm initialSettings={settings} initialModels={availableModels} initialAlbums={availableAlbums} />
    </div>
  );
}
