import { readAppSettingsSync } from "@/lib/settings";

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, "");

export function getImmichConfig() {
  const settings = readAppSettingsSync();
  const baseUrl = settings.immich.baseUrl || process.env.IMMICH_BASE_URL;

  if (!baseUrl) {
    throw new Error("IMMICH_BASE_URL saknas.");
  }

  return {
    baseUrl: trimTrailingSlash(baseUrl),
    apiKey: settings.immich.accessMode === "apiKey" ? settings.immich.apiKey || process.env.IMMICH_API_KEY : undefined,
    shareKey:
      settings.immich.accessMode === "shareKey" ? settings.immich.shareKey || process.env.IMMICH_SHARE_KEY : undefined,
    albumId: settings.immich.albumId || process.env.IMMICH_ALBUM_ID
  };
}

export function getAiConfig() {
  const settings = readAppSettingsSync();
  const provider = settings.ai.provider;

  if (provider === "lmstudio") {
    const baseUrl = settings.ai.lmstudio.baseUrl;
    const model = settings.ai.lmstudio.model;

    if (!baseUrl) {
      throw new Error("LMSTUDIO_BASE_URL saknas.");
    }

    if (!model) {
      throw new Error("LMSTUDIO_MODEL saknas.");
    }

    return {
      provider: "lmstudio" as const,
      baseUrl: trimTrailingSlash(baseUrl),
      model,
      apiKey: settings.ai.lmstudio.apiKey,
      contextLength: settings.ai.lmstudio.contextLength
    };
  }

  if (provider === "anthropic") {
    const baseUrl = settings.ai.anthropic.baseUrl;
    const model = settings.ai.anthropic.model;

    if (!baseUrl) {
      throw new Error("ANTHROPIC_BASE_URL saknas.");
    }

    if (!model) {
      throw new Error("ANTHROPIC_MODEL saknas.");
    }

    return {
      provider: "anthropic" as const,
      baseUrl: trimTrailingSlash(baseUrl),
      model,
      apiKey: settings.ai.anthropic.apiKey
    };
  }

  if (provider === "openrouter") {
    const baseUrl = settings.ai.openrouter.baseUrl;
    const model = settings.ai.openrouter.model;

    if (!baseUrl) {
      throw new Error("OPENROUTER_BASE_URL saknas.");
    }

    if (!model) {
      throw new Error("OPENROUTER_MODEL saknas.");
    }

    return {
      provider: "openrouter" as const,
      baseUrl: trimTrailingSlash(baseUrl),
      model,
      apiKey: settings.ai.openrouter.apiKey
    };
  }

  return {
    provider: "openai" as const,
    baseUrl: trimTrailingSlash(settings.ai.openai.baseUrl || "https://api.openai.com/v1"),
    model: settings.ai.openai.model || "gpt-4.1-mini",
    apiKey: settings.ai.openai.apiKey
  };
}
