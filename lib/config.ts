import { readAppSettingsSync } from "@/lib/settings";
import type { AppSettings } from "@/lib/types";

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, "");

export function languageNameForPrompt(code?: string): string {
  if (code === "sv") return "Swedish";
  if (code === "de") return "German";
  return "English";
}

export function getEffectivePrompts(settings: AppSettings) {
  const aiConfig = getAiConfig();
  const key = `${aiConfig.provider}:${aiConfig.model}`;
  const override = settings.modelPrompts?.[key] ?? {};
  return {
    ...settings.prompts,
    ...override,
    photoRoleSpecificPrompts: {
      ...settings.prompts.photoRoleSpecificPrompts,
      ...(override.photoRoleSpecificPrompts ?? {}),
      label: {
        ...settings.prompts.photoRoleSpecificPrompts.label,
        ...(override.photoRoleSpecificPrompts?.label ?? {})
      },
      location: {
        ...settings.prompts.photoRoleSpecificPrompts.location,
        ...(override.photoRoleSpecificPrompts?.location ?? {})
      },
      inside: {
        ...settings.prompts.photoRoleSpecificPrompts.inside,
        ...(override.photoRoleSpecificPrompts?.inside ?? {})
      },
      spread: {
        ...settings.prompts.photoRoleSpecificPrompts.spread,
        ...(override.photoRoleSpecificPrompts?.spread ?? {})
      },
      detail: {
        ...settings.prompts.photoRoleSpecificPrompts.detail,
        ...(override.photoRoleSpecificPrompts?.detail ?? {})
      }
    }
  };
}

export function getOpenRouterHeaders(title: string) {
  const settings = readAppSettingsSync();
  const referer = trimTrailingSlash(
    settings.security.appBaseUrl || process.env.OPENROUTER_APP_URL || process.env.APP_BASE_URL || "https://lager.yourdomain.com"
  );

  return {
    "HTTP-Referer": referer,
    "X-Title": title
  };
}

export function getPhotoSourceConfig() {
  const settings = readAppSettingsSync();
  const baseUrl = settings.immich.baseUrl || process.env.IMMICH_BASE_URL;

  if (!baseUrl) {
    throw new Error("IMMICH_BASE_URL saknas.");
  }

  return {
    provider: settings.immich.provider || "immich",
    baseUrl: trimTrailingSlash(baseUrl),
    accountLabel: settings.immich.accountLabel || process.env.IMMICH_ACCOUNT_LABEL || "",
    apiKey: settings.immich.accessMode === "apiKey" ? settings.immich.apiKey || process.env.IMMICH_API_KEY : undefined,
    shareKey:
      settings.immich.accessMode === "shareKey" ? settings.immich.shareKey || process.env.IMMICH_SHARE_KEY : undefined,
    albumId: settings.immich.albumId || process.env.IMMICH_ALBUM_ID || "",
    accessMode: settings.immich.accessMode
  };
}

export function getImmichConfig() {
  const config = getPhotoSourceConfig();
  if (config.provider !== "immich") {
    throw new Error(`Current photo source '${config.provider}' is not supported by the legacy Immich helper.`);
  }

  return config;
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
