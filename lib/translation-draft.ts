import { assertAiApiKey, extractJsonObject, generateAiText } from "@/lib/ai-client";
import { getTranslationAiConfig } from "@/lib/config";
import { readLanguageCatalog } from "@/lib/i18n";
import { readAppSettingsSync } from "@/lib/settings";

type DraftRequest = {
  sourceCode: string;
  targetCode: string;
  section?: string;
  sourceEntries: Record<string, string>;
  existingTargetEntries: Record<string, string>;
};

async function sendTranslationPrompt(prompt: string) {
  const aiConfig = getTranslationAiConfig();
  assertAiApiKey(aiConfig);

  return generateAiText(aiConfig, {
    system: readAppSettingsSync().prompts.translationDraftSystemPrompt,
    userText: prompt,
    maxTokens: 3000,
    jsonObject: true,
    jsonSchema: {
      name: "translation_draft",
      schema: { type: "object", additionalProperties: { type: "string" } }
    },
    title: "Lagersystem - Translation"
  });
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
  const draftableSourceEntries = Object.fromEntries(keys.map((key) => [key, sourceEntries[key] ?? ""]));

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
    JSON.stringify(draftableSourceEntries, null, 2)
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
