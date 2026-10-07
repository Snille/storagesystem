import { assertAiApiKey, extractJsonObject, generateAiText } from "@/lib/ai-client";
import { getAiConfig, getEffectivePrompts, languageNameForPrompt } from "@/lib/config";
import { getCurrentSessionByBox, readInventoryData } from "@/lib/data-store";
import { createTranslator, readLanguageCatalogSync } from "@/lib/i18n";
import { presentLocation } from "@/lib/location-presentation";
import { fetchAlbumAssetsCached } from "@/lib/photo-source";
import { getPublicApiKey, signPublicAsset, type PublicAssetVariant } from "@/lib/public-api-auth";
import { searchInventory } from "@/lib/search";
import { readAppSettingsSync } from "@/lib/settings";

// Response shapes here are a contract with the Home Assistant integration
// (Snille/storagesystem-ha). Add fields freely; do not rename or remove any.

type PublicPhoto = {
  photoId: string;
  immichAssetId: string;
  role: string;
  capturedAt?: string;
  notes?: string;
  thumbnailUrl: string;
  originalUrl: string;
};

export type PublicBoxResult = {
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

type PublicContext = {
  languageCode: string;
  t: ReturnType<typeof createTranslator>;
  baseUrl: string;
  apiKey: string;
};

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

/** Reads settings, language and key once per request instead of once per photo. */
function createPublicContext(languageCode?: string): PublicContext {
  const settings = readAppSettingsSync();
  const code = languageCode?.trim() || settings.appearance.language || "en";
  return {
    languageCode: code,
    t: createTranslator(readLanguageCatalogSync(code)),
    baseUrl: trimTrailingSlash(settings.security.appBaseUrl?.trim() || process.env.APP_BASE_URL?.trim() || ""),
    apiKey: getPublicApiKey()
  };
}

function toAbsoluteUrl(context: PublicContext, pathname: string) {
  return context.baseUrl ? `${context.baseUrl}${pathname}` : pathname;
}

// Photo URLs are loaded by browsers (the HA card), so they cannot send headers.
// They carry a signature for that one photo instead of the API key itself.
function toPublicAssetUrl(context: PublicContext, assetId: string, variant: PublicAssetVariant) {
  const pathname = `/api/public/assets/${encodeURIComponent(assetId)}/${variant}`;
  const suffix = context.apiKey ? `?sig=${signPublicAsset(assetId, variant, context.apiKey)}` : "";
  return toAbsoluteUrl(context, `${pathname}${suffix}`);
}

function getLocationLabels(t: PublicContext["t"]) {
  return {
    shelvingUnit: t("boxForm.ivar", "Lagerhylla"),
    bench: t("boxForm.bench", "Bänk"),
    cabinet: t("boxForm.cabinet", "Skåp"),
    surface: t("boxForm.surface", "Yta"),
    slot: t("boxForm.place", "Plats"),
    shelfRow: t("locations.shelfLabel", "Hylla {count}", { count: "{count}" }),
    benchTop: t("boxForm.benchTop", "Ovanpå"),
    benchUnder: t("boxForm.benchUnder", "Under")
  };
}

export function getPublicLocationLabels(languageCode?: string) {
  return getLocationLabels(createPublicContext(languageCode).t);
}

function buildPublicBoxResult(input: ReturnType<typeof searchInventory>[number], context: PublicContext): PublicBoxResult {
  const location = presentLocation(input.box.currentLocationId, input.box.boxId, getLocationLabels(context.t));

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
      thumbnailUrl: toPublicAssetUrl(context, photo.immichAssetId, "thumbnail"),
      originalUrl: toPublicAssetUrl(context, photo.immichAssetId, "original")
    })),
    score: input.score
  };
}

function formatLocation(match: PublicBoxResult) {
  return `${match.location.system}, ${match.location.shelf}, ${match.location.slot}`;
}

export function buildLocalAnswer(query: string, matches: PublicBoxResult[], t: PublicContext["t"]) {
  if (matches.length === 0) {
    return t("publicApi.answerNone", 'Jag hittade ingen tydlig träff för "{query}".', { query });
  }

  if (matches.length === 1) {
    return t("publicApi.answerSingle", "{label} finns i {location}.", {
      label: matches[0].label,
      location: formatLocation(matches[0])
    });
  }

  const joined = matches
    .slice(0, 3)
    .map((match) => t("publicApi.answerMatchItem", "{label} i {location}", { label: match.label, location: formatLocation(match) }))
    .join("; ");

  return t("publicApi.answerMultiple", 'Jag hittade {count} möjliga träffar för "{query}". De tydligaste är: {matches}.', {
    count: matches.length,
    query,
    matches: joined
  });
}

const LOCATION_RULE: Record<string, string> = {
  sv: "Om du nämner en plats ska du alltid använda det mänskligt läsbara location-fältet exakt som det ges i kontexten. Nämn aldrig interna ID:n eller kodliknande värden som boxId, locationId eller strängar som liknar IVAR-B-H3-P1-A eller CABINET-A-H1-P1.",
  de: "Wenn du einen Ort nennst, verwende immer das menschenlesbare location-Feld genau wie es im Kontext angegeben ist. Nenne niemals interne IDs oder kodeartige Werte wie boxId, locationId oder Zeichenfolgen wie IVAR-B-H3-P1-A oder CABINET-A-H1-P1.",
  en: "When mentioning a location, always use the human-readable location field exactly as given in the context. Never mention internal IDs or code-like values such as boxId, locationId, or strings resembling IVAR-B-H3-P1-A or CABINET-A-H1-P1."
};

const DEFAULT_ASK_PROMPTS = {
  voice:
    'You answer questions about where things are stored in a workshop. Use only the provided context. Answer naturally in 1 to 2 short sentences. Do not invent boxes or locations. Reply only as JSON on the form {"answer":"..."}',
  public:
    'You answer briefly about where things are stored in a workshop. Use only the provided context. If the matches are uncertain, say so. Do not invent boxes or locations. Reply only as JSON on the form {"answer":"..."}'
};

export function parseAnswerText(text: string) {
  const trimmed = text.trim();
  const candidate = extractJsonObject(trimmed);
  if (candidate.startsWith("{")) {
    try {
      const parsed = JSON.parse(candidate) as { answer?: unknown };
      if (typeof parsed.answer === "string" && parsed.answer.trim()) {
        return parsed.answer.trim();
      }
    } catch {
      // not JSON; use the text as it is
    }
  }

  return trimmed.replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
}

async function askAiForInventoryAnswer(query: string, matches: PublicBoxResult[], mode: "public" | "voice", languageCode: string) {
  const aiConfig = getAiConfig();
  assertAiApiKey(aiConfig);
  const prompts = getEffectivePrompts(readAppSettingsSync());
  const baseSystemPrompt =
    (mode === "voice" ? prompts.voiceAskSystemPrompt : prompts.publicAskSystemPrompt)?.trim() || DEFAULT_ASK_PROMPTS[mode];
  const context = matches.slice(0, 5).map((match) => ({
    label: match.label,
    location: formatLocation(match),
    summary: match.summary ?? "",
    keywords: match.itemKeywords
  }));

  const text = await generateAiText(aiConfig, {
    system: [
      `You must answer in ${languageNameForPrompt(languageCode)}. Do not use any other language.`,
      baseSystemPrompt,
      LOCATION_RULE[languageCode] ?? LOCATION_RULE.en
    ].join("\n\n"),
    userText: [`Query: ${query}`, "", "Candidates:", JSON.stringify(context, null, 2)].join("\n"),
    maxTokens: 300,
    title: "Lagersystem - Public Ask"
  });

  return parseAnswerText(text);
}

export async function searchPublicInventory(query: string, limit = 10, languageCode?: string) {
  const context = createPublicContext(languageCode);
  const [data, albumAssets] = await Promise.all([readInventoryData(), fetchAlbumAssetsCached().catch(() => [])]);
  const assetFileNamesById = new Map(albumAssets.map((asset) => [asset.id, asset.originalFileName]));
  const results = searchInventory(data, query, assetFileNamesById).slice(0, Math.max(1, Math.min(limit, 25)));
  return results.map((result) => buildPublicBoxResult(result, context));
}

export async function getPublicBoxById(boxId: string, languageCode?: string) {
  const data = await readInventoryData();
  const box = data.boxes.find((entry) => entry.boxId === boxId);

  if (!box) {
    return null;
  }

  const session = getCurrentSessionByBox(data).get(box.boxId);
  const photos = session ? data.photos.filter((photo) => photo.sessionId === session.sessionId) : [];
  return buildPublicBoxResult({ box, session, photos, score: 0 }, createPublicContext(languageCode));
}

export function publicBoxNotFoundMessage(languageCode?: string) {
  return createPublicContext(languageCode).t("publicApi.boxNotFound", "Lådan kunde inte hittas.");
}

export async function answerInventoryQuestion(query: string, mode: "public" | "voice" = "public", languageCode?: string) {
  const context = createPublicContext(languageCode);
  const matches = await searchPublicInventory(query, 5, context.languageCode);
  const localAnswer = buildLocalAnswer(query, matches, context.t);

  if (matches.length > 0) {
    try {
      const aiAnswer = await askAiForInventoryAnswer(query, matches, mode, context.languageCode);
      if (aiAnswer) {
        return { answer: aiAnswer, source: "ai" as const, matches };
      }
    } catch (error) {
      console.warn("[public-api] AI answer failed; using the local answer.", error instanceof Error ? error.message : error);
    }
  }

  return { answer: localAnswer, source: "search" as const, matches };
}
