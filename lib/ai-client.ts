import { getOpenRouterHeaders } from "@/lib/config";
import type { AiProvider } from "@/lib/types";

// One place that knows how to talk to each AI provider. Callers describe what they want
// (system text, user text, images, optional JSON schema); this module picks the wire format:
//   anthropic           -> POST {baseUrl}/v1/messages
//   openrouter/openwebui -> POST {baseUrl}/chat/completions
//   openai/lmstudio      -> POST {baseUrl}/responses

const DEFAULT_TIMEOUT_MS = 90_000;
const MODEL_LOAD_TIMEOUT_MS = 30_000;
const MAX_ERROR_BODY_CHARS = 500;

export type AiConfig = {
  provider: AiProvider;
  baseUrl: string;
  model: string;
  apiKey?: string;
  contextLength?: number;
};

export type AiImage = { contentType: string; base64: string };

export type AiProgressCallback = (message: string) => void | Promise<void>;

export type AiTextRequest = {
  system?: string;
  userText: string;
  images?: AiImage[];
  /** Image detail for the Responses API. Default "low". */
  imageDetail?: "low" | "high" | "auto";
  /** Output token limit. Anthropic requires one; default 1200. */
  maxTokens?: number;
  /** Structured output, applied on the Responses API (OpenAI, LM Studio). */
  jsonSchema?: { name: string; schema: Record<string, unknown> };
  /** Ask chat-completions providers for a JSON object. */
  jsonObject?: boolean;
  /** Request title shown in the OpenRouter dashboard. */
  title?: string;
  onProgress?: AiProgressCallback;
  timeoutMs?: number;
};

/** Hosted providers need a key; local ones (LM Studio, Open WebUI) may run without. */
export function hasRequiredAiApiKey(config: AiConfig) {
  return Boolean(config.apiKey) || config.provider === "lmstudio" || config.provider === "openwebui";
}

export function assertAiApiKey(config: AiConfig) {
  if (!hasRequiredAiApiKey(config)) {
    throw new Error("API-nyckel saknas för vald AI-motor.");
  }
}

function toDataUrl(image: AiImage) {
  return `data:${image.contentType};base64,${image.base64}`;
}

async function postJson(url: string, body: unknown, headers: Record<string, string>, timeoutMs: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body),
      signal: controller.signal,
      cache: "no-store"
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("AI-modellen svarade inte inom tidsgränsen.");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function failureMessage(response: Response) {
  const text = (await response.text().catch(() => "")).trim().slice(0, MAX_ERROR_BODY_CHARS);
  return `AI-anropet misslyckades: ${response.status}${text ? ` ${text}` : ""}`;
}

function requireText(text: string) {
  if (!text.trim()) {
    throw new Error("AI-motorn returnerade inget JSON-svar.");
  }
  return text.trim();
}

function bearer(apiKey?: string): Record<string, string> {
  return apiKey ? { Authorization: `Bearer ${apiKey}` } : {};
}

// ---------- response text extraction ----------

export function extractAnthropicText(json: unknown) {
  const content = (json as { content?: Array<{ type?: string; text?: string }> } | null)?.content;
  return (content ?? [])
    .filter((part) => part.type === "text" && typeof part.text === "string")
    .map((part) => part.text ?? "")
    .join("\n")
    .trim();
}

function collectTextParts(parts: unknown, chunks: string[]) {
  if (!Array.isArray(parts)) return;
  for (const part of parts) {
    const text = (part as { text?: unknown } | null)?.text;
    if (typeof text === "string" && text.trim()) {
      chunks.push(text);
    }
  }
}

export function extractResponsesText(json: unknown) {
  if (!json || typeof json !== "object") return "";

  const direct = (json as { output_text?: unknown }).output_text;
  if (typeof direct === "string" && direct.trim()) return direct.trim();

  const output = (json as { output?: unknown }).output;
  if (!Array.isArray(output)) return "";

  const chunks: string[] = [];
  for (const item of output) {
    collectTextParts((item as { content?: unknown } | null)?.content, chunks);
  }
  return chunks.join("\n").trim();
}

export function extractChatCompletionsText(json: unknown) {
  const choices = (json as { choices?: unknown } | null)?.choices;
  if (!Array.isArray(choices)) return "";

  const chunks: string[] = [];
  for (const choice of choices) {
    const content = (choice as { message?: { content?: unknown } } | null)?.message?.content;
    if (typeof content === "string" && content.trim()) {
      chunks.push(content);
    } else {
      collectTextParts(content, chunks);
    }
  }
  return chunks.join("\n").trim();
}

// ---------- providers ----------

async function sendAnthropic(config: AiConfig, request: AiTextRequest, timeoutMs: number) {
  await request.onProgress?.("Kontaktar AI-motorn...");
  const response = await postJson(
    `${config.baseUrl}/v1/messages`,
    {
      model: config.model,
      max_tokens: request.maxTokens ?? 1200,
      ...(request.system ? { system: request.system } : {}),
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: request.userText },
            ...(request.images ?? []).map((image) => ({
              type: "image",
              source: { type: "base64", media_type: image.contentType, data: image.base64 }
            }))
          ]
        }
      ]
    },
    { "anthropic-version": "2023-06-01", ...(config.apiKey ? { "x-api-key": config.apiKey } : {}) },
    timeoutMs
  );

  if (!response.ok) throw new Error(await failureMessage(response));
  const json = await response.json();
  await request.onProgress?.("Tolkar AI-svaret...");
  return requireText(extractAnthropicText(json));
}

async function sendChatCompletions(config: AiConfig, request: AiTextRequest, timeoutMs: number) {
  const name = config.provider === "openwebui" ? "Open WebUI" : "OpenRouter";
  await request.onProgress?.(`Kontaktar ${name}...`);

  const images = request.images ?? [];
  const userContent =
    images.length === 0
      ? request.userText
      : [
          { type: "text", text: request.userText },
          ...images.map((image) => ({ type: "image_url", image_url: { url: toDataUrl(image) } }))
        ];

  const responsePromise = postJson(
    `${config.baseUrl}/chat/completions`,
    {
      model: config.model,
      messages: [
        ...(request.system ? [{ role: "system", content: request.system }] : []),
        { role: "user", content: userContent }
      ],
      ...(request.jsonObject ? { response_format: { type: "json_object" } } : {}),
      // Reasoning models on OpenRouter (e.g. qwen3.5-flash) return their thinking or
      // garbage instead of the requested JSON. Models without reasoning ignore this.
      ...(config.provider === "openrouter" && (request.jsonObject || request.jsonSchema)
        ? { reasoning: { enabled: false } }
        : {})
    },
    {
      ...bearer(config.apiKey),
      ...(config.provider === "openrouter" ? getOpenRouterHeaders(request.title ?? "Lagersystem") : {})
    },
    timeoutMs
  );
  await request.onProgress?.(images.length ? `${name} bearbetar bilderna...` : `${name} bearbetar förfrågan...`);
  const response = await responsePromise;

  if (!response.ok) throw new Error(await failureMessage(response));
  const json = await response.json();
  await request.onProgress?.("Tolkar AI-svaret...");
  return requireText(extractChatCompletionsText(json));
}

async function ensureLmStudioModelLoaded(config: AiConfig, onProgress?: AiProgressCallback) {
  await onProgress?.("Laddar modell i LM Studio...");
  const rootUrl = config.baseUrl.endsWith("/v1") ? config.baseUrl.slice(0, -3) : config.baseUrl;
  let response: Response;

  try {
    response = await postJson(
      `${rootUrl}/api/v1/models/load`,
      {
        model: config.model,
        ...(config.contextLength ? { context_length: config.contextLength } : {}),
        flash_attention: true,
        offload_kv_cache_to_gpu: true
      },
      bearer(config.apiKey),
      MODEL_LOAD_TIMEOUT_MS
    );
  } catch (error) {
    if (error instanceof Error && error.message.includes("inom tidsgränsen")) {
      throw new Error("LM Studio hann inte ladda modellen i tid.");
    }
    throw error;
  }

  if (!response.ok) {
    throw new Error(`LM Studio kunde inte ladda modellen ${config.model}: ${response.status} ${await response.text()}`);
  }
}

async function sendResponses(config: AiConfig, request: AiTextRequest, timeoutMs: number) {
  const isLmStudio = config.provider === "lmstudio";
  const images = request.images ?? [];
  await request.onProgress?.(isLmStudio ? "Kontaktar LM Studio..." : "Kontaktar AI-motorn...");

  const body = {
    model: config.model,
    input: [
      ...(request.system ? [{ role: "system", content: [{ type: "input_text", text: request.system }] }] : []),
      {
        role: "user",
        content: [
          { type: "input_text", text: request.userText },
          ...images.map((image) => ({
            type: "input_image",
            image_url: toDataUrl(image),
            detail: request.imageDetail ?? "low"
          }))
        ]
      }
    ],
    ...(request.jsonSchema
      ? { text: { format: { type: "json_schema", name: request.jsonSchema.name, schema: request.jsonSchema.schema, strict: true } } }
      : {})
  };

  const inFlightMessage = isLmStudio
    ? images.length ? "LM Studio bearbetar bilderna..." : "LM Studio bearbetar förfrågan..."
    : "AI-motorn bearbetar förfrågan...";
  const send = async () => {
    const responsePromise = postJson(`${config.baseUrl}/responses`, body, bearer(config.apiKey), timeoutMs);
    await request.onProgress?.(inFlightMessage);
    return responsePromise;
  };

  let response = await send();

  // LM Studio unloads idle models; load it once and try again.
  if (!response.ok && isLmStudio) {
    const errorText = await response.text();
    if (!errorText.includes("Model unloaded")) {
      throw new Error(`AI-anropet misslyckades: ${response.status} ${errorText.slice(0, MAX_ERROR_BODY_CHARS)}`);
    }
    await ensureLmStudioModelLoaded(config, request.onProgress);
    await request.onProgress?.("Modellen är laddad. Väntar på svar...");
    response = await send();
  }

  if (!response.ok) throw new Error(await failureMessage(response));
  const json = await response.json();
  await request.onProgress?.("Tolkar AI-svaret...");
  return requireText(extractResponsesText(json));
}

/** Sends one prompt (optionally with images) to the configured provider and returns the reply text. */
export async function generateAiText(config: AiConfig, request: AiTextRequest): Promise<string> {
  const timeoutMs = request.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  if (config.provider === "anthropic") {
    return sendAnthropic(config, request, timeoutMs);
  }

  if (config.provider === "openrouter" || config.provider === "openwebui") {
    return sendChatCompletions(config, request, timeoutMs);
  }

  return sendResponses(config, request, timeoutMs);
}

/**
 * Finds the first complete JSON object in a reply, skipping prose or code fences around it.
 * Braces inside strings are ignored. Returns the trimmed input when no object is found.
 */
export function extractJsonObject(text: string) {
  const trimmed = text.trim();
  let startIndex = -1;
  let depth = 0;
  let inString = false;
  let isEscaped = false;

  for (let index = 0; index < trimmed.length; index += 1) {
    const character = trimmed[index];

    if (inString) {
      if (isEscaped) {
        isEscaped = false;
      } else if (character === "\\") {
        isEscaped = true;
      } else if (character === "\"") {
        inString = false;
      }
      continue;
    }

    if (character === "\"") {
      inString = true;
    } else if (character === "{") {
      if (depth === 0) startIndex = index;
      depth += 1;
    } else if (character === "}" && depth > 0) {
      depth -= 1;
      if (depth === 0 && startIndex >= 0) {
        return trimmed.slice(startIndex, index + 1);
      }
    }
  }

  return trimmed;
}
