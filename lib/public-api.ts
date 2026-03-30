import { getAiConfig, getOpenRouterHeaders } from "@/lib/config";
import { getCurrentSessionByBox, readInventoryData } from "@/lib/data-store";
import { fetchAlbumAssets, getAssetOriginalUrl, getAssetThumbnailUrl } from "@/lib/immich";
import { createTranslator, readLanguageCatalogSync } from "@/lib/i18n";
import { presentLocation } from "@/lib/location-presentation";
import { searchInventory } from "@/lib/search";
import { readAppSettingsSync } from "@/lib/settings";

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

function toAbsoluteUrl(pathname: string) {
  const settings = readAppSettingsSync();
  const baseUrl = settings.security.appBaseUrl?.trim() || process.env.APP_BASE_URL?.trim();
  if (!baseUrl) {
    return pathname;
  }

  return `${trimTrailingSlash(baseUrl)}${pathname.startsWith("/") ? pathname : `/${pathname}`}`;
}

function toPublicAssetUrl(assetId: string, variant: "thumbnail" | "original") {
  const settings = readAppSettingsSync();
  const pathname = `/api/public/assets/${assetId}/${variant}`;
  const key = settings.security.publicApiKey?.trim() || process.env.LAGERSYSTEM_API_KEY?.trim() || "";
  const suffix = key ? `?key=${encodeURIComponent(key)}` : "";
  return toAbsoluteUrl(`${pathname}${suffix}`);
}

type PublicPhoto = {
  photoId: string;
  immichAssetId: string;
  role: string;
  capturedAt?: string;
  notes?: string;
  thumbnailUrl: string;
  originalUrl: string;
};

type PublicBoxResult = {
  boxId: string;
  label: string;
  locationId: string;
  location: {
    system: string;
    shelf: string;
    slot: string;
  };
  boxNotes?: string;
  sessionId?: string;
  sessionCreatedAt?: string;
  summary?: string;
  sessionNotes?: string;
  itemKeywords: string[];
  photos: PublicPhoto[];
  score?: number;
};

function getPublicLocationLabels(languageCode?: string) {
  const settings = readAppSettingsSync();
  const catalog = readLanguageCatalogSync(languageCode || settings.appearance.language);
  const t = createTranslator(catalog);

  return {
    shelvingUnit: t("boxForm.ivar", "Lagerhylla"),
    bench: t("boxForm.bench", "Bänk"),
    cabinet: t("boxForm.cabinet", "Skåp"),
    surface: t("boxForm.surface", "Yta"),
    slot: t("boxForm.place", "Plats")
  };
}

function buildPublicBoxResult(input: ReturnType<typeof searchInventory>[number], languageCode?: string): PublicBoxResult {
  const location = presentLocation(input.box.currentLocationId, input.box.boxId, getPublicLocationLabels(languageCode));

  return {
    boxId: input.box.boxId,
    label: input.box.label,
    locationId: input.box.currentLocationId,
    location: {
      system: location.system,
      shelf: location.shelf,
      slot: location.slot
    },
    boxNotes: input.box.notes,
    sessionId: input.session?.sessionId,
    sessionCreatedAt: input.session?.createdAt,
    summary: input.session?.summary,
    sessionNotes: input.session?.notes,
    itemKeywords: input.session?.itemKeywords ?? [],
    photos: input.photos.map((photo) => ({
      photoId: photo.photoId,
      immichAssetId: photo.immichAssetId,
      role: photo.photoRole,
      capturedAt: photo.capturedAt,
      notes: photo.notes,
      thumbnailUrl: toPublicAssetUrl(photo.immichAssetId, "thumbnail"),
      originalUrl: toPublicAssetUrl(photo.immichAssetId, "original")
    })),
    score: input.score
  };
}

function buildLocalAnswer(query: string, matches: PublicBoxResult[]) {
  if (matches.length === 0) {
    return `Jag hittade ingen tydlig träff för "${query}".`;
  }

  if (matches.length === 1) {
    const match = matches[0];
    return `${match.label} finns i ${match.location.system}, ${match.location.shelf}, ${match.location.slot}.`;
  }

  const top = matches.slice(0, 3);
  const joined = top
    .map((match) => `${match.label} i ${match.location.system}, ${match.location.shelf}, ${match.location.slot}`)
    .join("; ");

  return `Jag hittade ${matches.length} möjliga träffar för "${query}". De tydligaste är: ${joined}.`;
}

function extractResponseText(json: unknown) {
  if (!json || typeof json !== "object") {
    return "";
  }

  const direct = (json as { output_text?: unknown }).output_text;
  if (typeof direct === "string" && direct.trim()) {
    return direct.trim();
  }

  const output = (json as { output?: unknown }).output;
  if (!Array.isArray(output)) {
    return "";
  }

  const chunks: string[] = [];
  for (const item of output) {
    if (!item || typeof item !== "object") continue;
    const content = (item as { content?: unknown }).content;
    if (!Array.isArray(content)) continue;

    for (const part of content) {
      if (!part || typeof part !== "object") continue;
      const text = (part as { text?: unknown }).text;
      if (typeof text === "string" && text.trim()) {
        chunks.push(text.trim());
      }
    }
  }

  return chunks.join("\n").trim();
}

async function askAiForInventoryAnswer(
  query: string,
  matches: PublicBoxResult[],
  mode: "public" | "voice" = "public",
  languageCode?: string
) {
  const aiConfig = getAiConfig();
  const settings = readAppSettingsSync();
  const context = matches.slice(0, 5).map((match) => ({
    label: match.label,
    location: `${match.location.system}, ${match.location.shelf}, ${match.location.slot}`,
    summary: match.summary ?? "",
    keywords: match.itemKeywords
  }));

  const immutableInstruction =
    'Om du nämner en plats ska du alltid använda det mänskligt läsbara location-fältet exakt som det ges i kontexten. Nämn aldrig interna ID:n eller kodliknande värden som boxId, locationId eller strängar som liknar IVAR-B-H3-P1-A eller CABINET-A-H1-P1.';

  const systemText =
    `${
      (mode === "voice" ? settings.prompts.voiceAskSystemPrompt : settings.prompts.publicAskSystemPrompt)?.trim() ||
      (mode === "voice"
        ? 'Du svarar på svenska om var saker finns i en verkstad. Använd endast den givna kontexten. Svara naturligt och uppläsningsvänligt i 1 till 2 korta meningar. Hitta inte på lådor eller platser. Svara endast som JSON på formen {"answer":"..."}'
        : 'Du svarar kort på svenska om var saker finns i en verkstad. Använd endast den givna kontexten. Om träffarna är osäkra, säg det. Hitta inte på lådor eller platser. Svara endast som JSON på formen {"answer":"..."}')
    }\n\n${immutableInstruction}`;
  const userText = [
    `Fråga: ${query}`,
    "",
    "Kandidater:",
    JSON.stringify(context, null, 2),
  ].join("\n");

  if (aiConfig.provider === "anthropic") {
    const response = await fetch(`${aiConfig.baseUrl}/v1/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "anthropic-version": "2023-06-01",
        ...(aiConfig.apiKey ? { "x-api-key": aiConfig.apiKey } : {})
      },
      body: JSON.stringify({
        model: aiConfig.model,
        max_tokens: 300,
        system: systemText,
        messages: [{ role: "user", content: [{ type: "text", text: userText }] }]
      }),
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error(`AI-svar misslyckades: ${response.status}`);
    }

    const json = (await response.json()) as { content?: Array<{ type?: string; text?: string }> };
    const text = (json.content ?? [])
      .filter((part) => part.type === "text" && typeof part.text === "string")
      .map((part) => part.text ?? "")
      .join("\n")
      .trim();

    return parseAnswerText(text);
  }

  const response = await fetch(`${aiConfig.baseUrl}/responses`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(aiConfig.apiKey ? { Authorization: `Bearer ${aiConfig.apiKey}` } : {}),
      ...(aiConfig.provider === "openrouter" ? getOpenRouterHeaders("Lagersystem - Public Ask") : {})
    },
    body: JSON.stringify({
      model: aiConfig.model,
      input: [
        { role: "system", content: [{ type: "input_text", text: systemText }] },
        { role: "user", content: [{ type: "input_text", text: userText }] }
      ]
    }),
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`AI-svar misslyckades: ${response.status}`);
  }

  const text = extractResponseText(await response.json());
  return parseAnswerText(text);
}

function parseAnswerText(text: string) {
  const trimmed = text.trim();
  const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]) as { answer?: string };
      if (typeof parsed.answer === "string" && parsed.answer.trim()) {
        return parsed.answer.trim();
      }
    } catch {
      // ignore
    }
  }

  return trimmed.replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
}

export async function searchPublicInventory(query: string, limit = 10, languageCode?: string) {
  const data = await readInventoryData();
  const albumAssets = await fetchAlbumAssets().catch(() => []);
  const assetFileNamesById = new Map(albumAssets.map((asset) => [asset.id, asset.originalFileName]));
  const results = searchInventory(data, query, assetFileNamesById).slice(0, Math.max(1, Math.min(limit, 25)));
  return results.map((result) => buildPublicBoxResult(result, languageCode));
}

export async function getPublicBoxById(boxId: string, languageCode?: string) {
  const data = await readInventoryData();
  const sessionsByBox = getCurrentSessionByBox(data);
  const box = data.boxes.find((entry) => entry.boxId === boxId);

  if (!box) {
    return null;
  }

  const session = sessionsByBox.get(box.boxId);
  const photos = data.photos.filter((photo) => photo.sessionId === session?.sessionId);

  return buildPublicBoxResult({
    box,
    session,
    photos,
    score: 0
  }, languageCode);
}

export async function answerInventoryQuestion(query: string, mode: "public" | "voice" = "public", languageCode?: string) {
  const matches = await searchPublicInventory(query, 5, languageCode);
  const localAnswer = buildLocalAnswer(query, matches);

  if (matches.length === 0) {
    return {
      answer: localAnswer,
      source: "search" as const,
      matches
    };
  }

  try {
    const aiAnswer = await askAiForInventoryAnswer(query, matches, mode, languageCode);
    if (aiAnswer) {
      return {
        answer: aiAnswer,
        source: "ai" as const,
        matches
      };
    }
  } catch {
    // fall back to local answer
  }

  return {
    answer: localAnswer,
    source: "search" as const,
    matches
  };
}
