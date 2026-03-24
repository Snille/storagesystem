import type { AiProvider, AvailableModel } from "@/lib/types";

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, "");

async function fetchJson(url: string, init?: RequestInit) {
  const response = await fetch(url, {
    ...init,
    cache: "no-store"
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Kunde inte hämta modeller: ${response.status} ${text}`);
  }

  return response.json() as Promise<unknown>;
}

export async function fetchAvailableModels(input: {
  provider: AiProvider;
  baseUrl: string;
  apiKey?: string;
}): Promise<AvailableModel[]> {
  const provider = input.provider;
  const baseUrl = trimTrailingSlash(input.baseUrl);
  const apiKey = input.apiKey?.trim();

  if (!baseUrl) {
    return [];
  }

  if (provider === "anthropic") {
    const json = (await fetchJson(`${baseUrl}/v1/models`, {
      headers: {
        ...(apiKey ? { "x-api-key": apiKey } : {}),
        "anthropic-version": "2023-06-01"
      }
    })) as { data?: Array<{ id?: string; display_name?: string }> };

    return (json.data ?? [])
      .map((model) => ({
        id: model.id ?? "",
        label: model.display_name || model.id || ""
      }))
      .filter((model) => model.id);
  }

  if (provider === "openrouter") {
    const json = (await fetchJson(`${baseUrl}/models`, {
      headers: {
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {})
      }
    })) as { data?: Array<{ id?: string; name?: string }> };

    return (json.data ?? [])
      .map((model) => ({
        id: model.id ?? "",
        label: model.name || model.id || ""
      }))
      .filter((model) => model.id);
  }

  if (provider === "openwebui") {
    const json = (await fetchJson(`${baseUrl}/models`, {
      headers: {
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {})
      }
    })) as
      | { data?: Array<{ id?: string; name?: string; model?: string }> }
      | Array<{ id?: string; name?: string; model?: string }>;

    const list = Array.isArray(json) ? json : (json.data ?? []);

    return list
      .map((model) => ({
        id: model.id ?? model.model ?? "",
        label: model.name || model.id || model.model || ""
      }))
      .filter((model) => model.id);
  }

  const json = (await fetchJson(`${baseUrl}/models`, {
    headers: apiKey
      ? provider === "lmstudio"
        ? { Authorization: `Bearer ${apiKey}` }
        : { Authorization: `Bearer ${apiKey}` }
      : undefined
  })) as { data?: Array<{ id?: string }> };

  return (json.data ?? [])
    .map((model) => ({
      id: model.id ?? "",
      label: model.id ?? ""
    }))
    .filter((model) => model.id);
}
