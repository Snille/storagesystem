import { getOpenRouterHeaders, getTranslationAiConfig } from "@/lib/config";
import { readLanguageCatalog } from "@/lib/i18n";
import { readAppSettingsSync } from "@/lib/settings";

const AI_REQUEST_TIMEOUT_MS = 90_000;

type DraftRequest = {
  sourceCode: string;
  targetCode: string;
  section?: string;
  sourceEntries: Record<string, string>;
  existingTargetEntries: Record<string, string>;
};

function extractJsonObject(value: string) {
  const fencedMatch = value.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fencedMatch?.[1]) {
    return fencedMatch[1].trim();
  }

  const firstBrace = value.indexOf("{");
  const lastBrace = value.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return value.slice(firstBrace, lastBrace + 1);
  }

  return value.trim();
}

async function postResponsesRequest(baseUrl: string, body: object, apiKey?: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), AI_REQUEST_TIMEOUT_MS);

  try {
    return await fetch(`${baseUrl}/responses`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {})
      },
      body: JSON.stringify(body),
      signal: controller.signal
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

async function postChatCompletionsRequest(
  baseUrl: string,
  body: object,
  apiKey?: string,
  extraHeaders?: Record<string, string>
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), AI_REQUEST_TIMEOUT_MS);

  try {
    return await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
        ...(extraHeaders ?? {})
      },
      body: JSON.stringify(body),
      signal: controller.signal
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

async function sendAnthropicRequest(baseUrl: string, model: string, apiKey: string, prompt: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), AI_REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(`${baseUrl}/v1/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model,
        max_tokens: 3000,
        system: "You are a translation assistant. Reply with JSON only.",
        messages: [
          {
            role: "user",
            content: prompt
          }
        ]
      }),
      signal: controller.signal
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("AI-modellen svarade inte inom tidsgränsen.");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    throw new Error(`Anthropic svarade med ${response.status}.`);
  }

  const payload = (await response.json()) as {
    content?: Array<{ type?: string; text?: string }>;
  };
  const text = payload.content?.find((item) => item.type === "text")?.text ?? "";
  if (!text) {
    throw new Error("Anthropic returnerade inget svar.");
  }

  return text;
}

async function sendTranslationPrompt(prompt: string) {
  const aiConfig = getTranslationAiConfig();
  const translationSystemPrompt = readAppSettingsSync().prompts.translationDraftSystemPrompt;

  if (
    (aiConfig.provider === "openai" ||
      aiConfig.provider === "anthropic" ||
      aiConfig.provider === "openrouter" ||
      aiConfig.provider === "openwebui") &&
    !aiConfig.apiKey
  ) {
    if (aiConfig.provider !== "openwebui") {
      throw new Error("API-nyckel saknas för vald AI-motor.");
    }
  }

  if (aiConfig.provider === "anthropic") {
    if (!aiConfig.apiKey) {
      throw new Error("API-nyckel saknas för Anthropic.");
    }

    return sendAnthropicRequest(aiConfig.baseUrl, aiConfig.model, aiConfig.apiKey, prompt);
  }

  if (aiConfig.provider === "openrouter" || aiConfig.provider === "openwebui") {
    const response = await postChatCompletionsRequest(
      aiConfig.baseUrl,
      {
        model: aiConfig.model,
        messages: [
          {
            role: "system",
            content: translationSystemPrompt
          },
          {
            role: "user",
            content: prompt
          }
        ],
        response_format: {
          type: "json_object"
        }
      },
      aiConfig.apiKey,
      aiConfig.provider === "openrouter" ? getOpenRouterHeaders("Lagersystem - Translation") : undefined
    );

    if (!response.ok) {
      throw new Error(`${aiConfig.provider} svarade med ${response.status}.`);
    }

    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const text = payload.choices?.[0]?.message?.content ?? "";
    if (!text) {
      throw new Error("AI-motorn returnerade inget svar.");
    }

    return text;
  }

  const response = await postResponsesRequest(
    aiConfig.baseUrl,
    {
      model: aiConfig.model,
      input: [
        {
          role: "system",
          content: [
            {
              type: "input_text",
              text: translationSystemPrompt
            }
          ]
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: prompt
            }
          ]
        }
      ],
      text: {
        format: {
          type: "json_schema",
          name: "translation_draft",
          schema: {
            type: "object",
            additionalProperties: {
              type: "string"
            }
          },
          strict: true
        }
      }
    },
    aiConfig.apiKey
  );

  if (!response.ok) {
    throw new Error(`AI-motorn svarade med ${response.status}.`);
  }

  const payload = (await response.json()) as {
    output_text?: string;
  };
  const text = payload.output_text ?? "";
  if (!text) {
    throw new Error("AI-motorn returnerade inget svar.");
  }

  return text;
}

function normalizeDraftEntries(
  keys: string[],
  parsed: Record<string, unknown>,
  existingTargetEntries: Record<string, string>
) {
  const nextEntries: Record<string, string> = {};

  for (const key of keys) {
    const value = parsed[key];
    if (typeof value === "string" && value.trim()) {
      nextEntries[key] = value.trim();
    } else if (!existingTargetEntries[key]?.trim()) {
      nextEntries[key] = "";
    }
  }

  return nextEntries;
}

export async function buildTranslationDraft({
  sourceCode,
  targetCode,
  section,
  sourceEntries,
  existingTargetEntries
}: DraftRequest) {
  const [sourceCatalog, targetCatalog] = await Promise.all([
    readLanguageCatalog(sourceCode),
    readLanguageCatalog(targetCode)
  ]);
  const keys = Object.keys(sourceEntries).filter((key) => !existingTargetEntries[key]?.trim());

  if (keys.length === 0) {
    return {
      entries: {} as Record<string, string>,
      count: 0
    };
  }

  const prompt = [
    `Translate the following UI strings from ${sourceCatalog._meta.label} (${sourceCode}) to ${targetCatalog._meta.label} (${targetCode}).`,
    "Keep the tone concise and natural for a user interface.",
    "Preserve placeholders like {count}, {label}, {name}, punctuation, and line breaks when present.",
    "Return one JSON object where each property key is unchanged and each value is the translated string.",
    section && section !== "all" ? `The strings are from the section '${section}'.` : "",
    "",
    JSON.stringify(sourceEntries, null, 2)
  ]
    .filter(Boolean)
    .join("\n");

  const responseText = await sendTranslationPrompt(prompt);
  let parsed: Record<string, unknown>;

  try {
    parsed = JSON.parse(extractJsonObject(responseText)) as Record<string, unknown>;
  } catch {
    throw new Error("AI-svaret gick inte att tolka som JSON.");
  }

  const entries = normalizeDraftEntries(keys, parsed, existingTargetEntries);
  return {
    entries: Object.fromEntries(Object.entries(entries).filter(([, value]) => value.trim())),
    count: Object.values(entries).filter((value) => value.trim()).length
  };
}
