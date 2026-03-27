import { readAppSettingsSync } from "@/lib/settings";

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, "");

export function getOpenRouterHeaders(title: string) {
  const referer = trimTrailingSlash(
    process.env.OPENROUTER_APP_URL || process.env.APP_BASE_URL || "https://lager.yourdomain.com"
  );

  return {
    "HTTP-Referer": referer,
    "X-Title": title
  };
}

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
  return getAiConfigFromSettings(settings.ai);
}

export function getTranslationAiConfig() {
  const settings = readAppSettingsSync();
  return getAiConfigFromSettings(withInheritedApiKeys(settings.translationAi, settings.ai));
}

function getAiConfigFromSettings(aiSettings: ReturnType<typeof readAppSettingsSync>["ai"]) {
  const provider = aiSettings.provider;

  if (provider === "lmstudio") {
    const baseUrl = aiSettings.lmstudio.baseUrl;
    const model = aiSettings.lmstudio.model;

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
      apiKey: aiSettings.lmstudio.apiKey,
      contextLength: aiSettings.lmstudio.contextLength
    };
  }

  if (provider === "anthropic") {
    const baseUrl = aiSettings.anthropic.baseUrl;
    const model = aiSettings.anthropic.model;

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
      apiKey: aiSettings.anthropic.apiKey
    };
  }

  if (provider === "openrouter") {
    const baseUrl = aiSettings.openrouter.baseUrl;
    const model = aiSettings.openrouter.model;

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
      apiKey: aiSettings.openrouter.apiKey
    };
  }

  if (provider === "openwebui") {
    const baseUrl = aiSettings.openwebui.baseUrl;
    const model = aiSettings.openwebui.model;

    if (!baseUrl) {
      throw new Error("OPENWEBUI_BASE_URL saknas.");
    }

    if (!model) {
      throw new Error("OPENWEBUI_MODEL saknas.");
    }

    return {
      provider: "openwebui" as const,
      baseUrl: trimTrailingSlash(baseUrl),
      model,
      apiKey: aiSettings.openwebui.apiKey
    };
  }

  return {
    provider: "openai" as const,
    baseUrl: trimTrailingSlash(aiSettings.openai.baseUrl || "https://api.openai.com/v1"),
    model: aiSettings.openai.model || "gpt-4.1-mini",
    apiKey: aiSettings.openai.apiKey
  };
}

function withInheritedApiKeys(
  translationAi: ReturnType<typeof readAppSettingsSync>["translationAi"],
  primaryAi: ReturnType<typeof readAppSettingsSync>["ai"]
) {
  return {
    ...translationAi,
    lmstudio: {
      ...translationAi.lmstudio,
      apiKey: translationAi.lmstudio.apiKey || primaryAi.lmstudio.apiKey
    },
    openai: {
      ...translationAi.openai,
      apiKey: translationAi.openai.apiKey || primaryAi.openai.apiKey
    },
    anthropic: {
      ...translationAi.anthropic,
      apiKey: translationAi.anthropic.apiKey || primaryAi.anthropic.apiKey
    },
    openrouter: {
      ...translationAi.openrouter,
      apiKey: translationAi.openrouter.apiKey || primaryAi.openrouter.apiKey
    },
    openwebui: {
      ...translationAi.openwebui,
      apiKey: translationAi.openwebui.apiKey || primaryAi.openwebui.apiKey
    }
  };
}
