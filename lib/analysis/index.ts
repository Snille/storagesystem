import {
  extractJsonObject,
  generateAiText,
  hasRequiredAiApiKey,
  type AiConfig,
  type AiImage,
  type AiProgressCallback
} from "@/lib/ai-client";
import { type CandidateRecord, buildCatalogContext, enrichWithMatches } from "@/lib/analysis/matching";
import {
  cleanSuggestedBoxSummary,
  cleanSuggestedNotes,
  describeAnalysisFailure,
  guessPhotoRoles,
  hasLabelPhoto,
  inferSummaryFromParsed,
  isUsefulSuggestion,
  normalizeSuggestedPhotos,
  parseAnalysisSuggestionResponse,
  parseSinglePhotoSummaryResponse,
  parseSummaryCleanupPrefixes,
  sanitizeKeywordList,
  sanitizeRole,
  sortSuggestedPhotos
} from "@/lib/analysis/response-parsing";
import { getAiConfig, getEffectivePrompts, languageNameForPrompt } from "@/lib/config";
import { getCurrentSessionByBox, readInventoryData } from "@/lib/data-store";
import { fetchAlbumAssets, fetchAssetThumbnailResponse } from "@/lib/photo-source";
import { readAppSettingsSync } from "@/lib/settings";
import type { AnalysisSuggestion, ImmichAsset, PhotoRole } from "@/lib/types";

// Photo analysis: turns selected album photos into a box suggestion (label, location,
// summary, keywords, photo roles). Provider details live in lib/ai-client.ts; parsing and
// clean-up of replies in ./response-parsing.ts; matching against known boxes in ./matching.ts.

const PHOTO_ROLES: PhotoRole[] = ["label", "location", "inside", "spread", "detail"];

function buildFallbackSessionId(assets: ImmichAsset[]) {
  const first = assets[0];
  const stamp = first?.fileCreatedAt ?? new Date().toISOString();
  const compact = stamp.replace(/[-:]/g, "").replace(/\..*/, "").replace("T", "-");
  return `INV-${compact}`;
}

function buildFallbackSuggestion(assets: ImmichAsset[]): AnalysisSuggestion {
  const first = assets[0];

  return {
    sessionId: buildFallbackSessionId(assets),
    suggestedBoxId: "",
    suggestedLabel: "",
    suggestedLocationId: "",
    suggestedSummary: "Utkast skapat utan AI-analys. Fyll i etikett, plats och innehåll manuellt.",
    suggestedKeywords: [],
    suggestedNotes: first
      ? `Skapat från ${assets.length} markerade Immich-bilder. Första fil: ${first.originalFileName}.`
      : "Skapat från markerade Immich-bilder.",
    suggestedPhotos: guessPhotoRoles(assets),
    confidence: "low",
    source: "fallback",
    matchCandidates: []
  };
}

/** Fetches a thumbnail through the configured photo source (Immich or PhotoPrism). */
async function fetchAssetImage(assetId: string): Promise<AiImage> {
  const response = await fetchAssetThumbnailResponse(assetId);

  if (!response.ok) {
    throw new Error(`Kunde inte hämta thumbnail för ${assetId}.`);
  }

  return {
    contentType: response.headers.get("content-type") ?? "image/jpeg",
    base64: Buffer.from(await response.arrayBuffer()).toString("base64")
  };
}

function describeAssets(assets: ImmichAsset[]) {
  return assets.map(
    (asset, index) => `${index + 1}. immichAssetId=${asset.id}, fileCreatedAt=${asset.fileCreatedAt}, fileName=${asset.originalFileName}`
  );
}

async function inferPhotoRoles(
  aiConfig: AiConfig,
  assets: ImmichAsset[],
  images: AiImage[],
  onProgress?: AiProgressCallback
): Promise<AnalysisSuggestion["suggestedPhotos"]> {
  const prompts = getEffectivePrompts(readAppSettingsSync());
  await onProgress?.("Klassificerar bildroller...");

  const results: AnalysisSuggestion["suggestedPhotos"] = [];
  for (const [index, asset] of assets.entries()) {
    let photoRole: PhotoRole = "detail";
    try {
      const responseText = await generateAiText(aiConfig, {
        system: prompts.photoRoleSystemPrompt,
        userText: prompts.photoRolePrompt,
        images: [images[index]],
        maxTokens: 220,
        jsonSchema: {
          name: "single_photo_role",
          schema: {
            type: "object",
            additionalProperties: false,
            properties: { photoRole: { type: "string", enum: PHOTO_ROLES } },
            required: ["photoRole"]
          }
        },
        title: "Lagersystem - Box Analysis",
        onProgress
      });
      const parsed = JSON.parse(extractJsonObject(responseText)) as { photoRole?: string };
      photoRole = sanitizeRole(parsed.photoRole ?? "detail");
    } catch {
      // keep "detail" for this photo
    }

    results.push({ immichAssetId: asset.id, photoRole, capturedAt: asset.fileCreatedAt });
  }

  return results;
}

async function recoverMissingLabelPhoto(
  aiConfig: AiConfig,
  assets: ImmichAsset[],
  images: AiImage[],
  currentPhotos: AnalysisSuggestion["suggestedPhotos"],
  onProgress?: AiProgressCallback
) {
  if (assets.length < 2 || hasLabelPhoto(currentPhotos)) {
    return currentPhotos;
  }

  await onProgress?.("Kontrollerar vilken bild som är etiketten...");

  const recoveryPrompt = [
    "Du får flera bilder som hör till samma låda.",
    "Välj exakt en bild som role=label om någon bild tydligt visar etiketten eller platslappen på lådans framsida.",
    "Om ingen bild tydligt visar etiketten ska du lämna labelAssetId tom.",
    "Var försiktig: välj inte label bara för att en liten etikett råkar synas i kanten.",
    "Svara endast med JSON på formen {\"labelAssetId\":\"...\"}.",
    "",
    "Bilder:",
    ...describeAssets(assets)
  ].join("\n");

  try {
    const responseText = await generateAiText(aiConfig, {
      system: "Du väljer vilken bild som tydligast visar en lådetikett och svarar endast med JSON.",
      userText: recoveryPrompt,
      images,
      maxTokens: 260,
      jsonSchema: {
        name: "label_photo_recovery",
        schema: {
          type: "object",
          additionalProperties: false,
          properties: { labelAssetId: { type: "string" } },
          required: ["labelAssetId"]
        }
      },
      title: "Lagersystem - Box Analysis",
      onProgress
    });

    const parsed = JSON.parse(extractJsonObject(responseText)) as { labelAssetId?: string };
    const labelAssetId =
      typeof parsed.labelAssetId === "string" && assets.some((asset) => asset.id === parsed.labelAssetId)
        ? parsed.labelAssetId
        : "";

    if (!labelAssetId) {
      return currentPhotos;
    }

    return currentPhotos.map((photo) =>
      photo.immichAssetId === labelAssetId ? { ...photo, photoRole: "label" as const } : photo
    );
  } catch {
    return currentPhotos;
  }
}

export async function analyzeSinglePhoto(
  assetId: string,
  onProgress?: AiProgressCallback,
  photoRole?: PhotoRole,
  language?: string
): Promise<string> {
  const aiConfig = getAiConfig();
  const settings = readAppSettingsSync();

  if (!hasRequiredAiApiKey(aiConfig)) {
    throw new Error("API-nyckel saknas för vald AI-motor.");
  }

  const prompts = getEffectivePrompts(settings);
  const roleSpecific = photoRole ? prompts.photoRoleSpecificPrompts[photoRole] : null;
  const langName = languageNameForPrompt(language ?? settings.appearance.language);
  const system = `You must respond in ${langName}. Do not use any other language.\n${roleSpecific?.systemPrompt || prompts.photoSummarySystemPrompt}`;
  const summaryPrompt = `${roleSpecific?.prompt || prompts.photoSummaryPrompt}\n\nIMPORTANT: Write your entire response in ${langName}.`;

  try {
    await onProgress?.("Hämtar bild från Immich...");
    const image = await fetchAssetImage(assetId);

    const responseText = await generateAiText(aiConfig, {
      system,
      userText: summaryPrompt,
      images: [image],
      maxTokens: 260,
      jsonSchema: {
        name: "single_photo_analysis",
        schema: {
          type: "object",
          additionalProperties: false,
          properties: { summary: { type: "string" } },
          required: ["summary"]
        }
      },
      title: "Lagersystem - Box Analysis",
      onProgress
    });

    await onProgress?.("Tolkar bildanalysen...");
    let summary = parseSinglePhotoSummaryResponse(responseText);

    if (!summary && aiConfig.provider !== "anthropic") {
      await onProgress?.("Första svaret var otydligt. Försöker igen...");
      const relaxedResponseText = await generateAiText(aiConfig, {
        system,
        userText: `${summaryPrompt}

Be pragmatic. Reply only with a single JSON object on the form {"summary":"..."}.
If you cannot identify everything, write a short description of the most visible content in ${langName}.`,
        images: [image],
        maxTokens: 260,
        title: "Lagersystem - Box Analysis",
        onProgress
      });

      summary = parseSinglePhotoSummaryResponse(relaxedResponseText);
    }

    await onProgress?.("Bildanalysen är klar.");
    return summary || "Ingen tydlig bildspecifik beskrivning kunde tas fram.";
  } catch (error) {
    const message = error instanceof Error ? error.message : "Bildspecifik analys misslyckades.";
    throw new Error(`Bildspecifik analys misslyckades. ${message}`);
  }
}

const BOX_ANALYSIS_SCHEMA = {
  name: "inventory_image_analysis",
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      suggestedBoxId: { type: "string" },
      suggestedLabel: { type: "string" },
      suggestedLocationId: { type: "string" },
      suggestedSummary: { type: "string" },
      suggestedKeywords: { type: "array", items: { type: "string" } },
      suggestedNotes: { type: "string" },
      confidence: { type: "string", enum: ["low", "medium", "high"] },
      suggestedPhotos: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            immichAssetId: { type: "string" },
            photoRole: { type: "string", enum: PHOTO_ROLES }
          },
          required: ["immichAssetId", "photoRole"]
        }
      }
    },
    required: [
      "suggestedBoxId",
      "suggestedLabel",
      "suggestedLocationId",
      "suggestedSummary",
      "suggestedKeywords",
      "suggestedNotes",
      "confidence",
      "suggestedPhotos"
    ]
  }
};

async function buildAiSuggestion(
  assets: ImmichAsset[],
  candidates: CandidateRecord[],
  onProgress?: AiProgressCallback
): Promise<AnalysisSuggestion> {
  const aiConfig = getAiConfig();
  const settings = readAppSettingsSync();

  if (!hasRequiredAiApiKey(aiConfig)) {
    return buildFallbackSuggestion(assets);
  }

  const prompts = getEffectivePrompts(settings);
  const langName = languageNameForPrompt(settings.appearance.language);
  const system = `You must write suggestedSummary, suggestedLabel, and suggestedKeywords in ${langName}. Do not use any other language for these fields.\n${prompts.anthropicBoxSystemPrompt}`;
  const instructions = `${prompts.boxAnalysisInstructions}\n\nIMPORTANT: Write suggestedSummary, suggestedLabel, and suggestedKeywords in ${langName}.`;
  const summaryCleanupPrefixes = parseSummaryCleanupPrefixes(prompts.summaryCleanupPrefixes);
  await onProgress?.("Förbereder bilder och katalog för analys...");

  const userText = [
    instructions,
    "",
    "Känd katalog:",
    buildCatalogContext(candidates),
    "",
    "Markerade filer:",
    ...describeAssets(assets)
  ].join("\n");
  const images = await Promise.all(assets.map((asset) => fetchAssetImage(asset.id)));

  const responseText = await generateAiText(aiConfig, {
    system,
    // Anthropic has no structured-output switch here, so it gets the schema as text.
    userText: aiConfig.provider === "anthropic" ? `${userText}\n\nJSON-schema:\n${JSON.stringify(BOX_ANALYSIS_SCHEMA.schema)}` : userText,
    images,
    maxTokens: 1400,
    jsonSchema: BOX_ANALYSIS_SCHEMA,
    title: "Lagersystem - Box Analysis",
    onProgress
  });

  await onProgress?.("Tolkar översiktsanalysen...");
  let parsed = parseAnalysisSuggestionResponse(responseText);

  if (!isUsefulSuggestion(parsed) && aiConfig.provider !== "anthropic") {
    await onProgress?.("Första svaret var otydligt. Försöker igen med enklare instruktion...");
    const relaxedResponseText = await generateAiText(aiConfig, {
      system,
      userText: `${instructions}

Reply with a single JSON object. Be pragmatic — a short useful suggestion is better than empty fields.
If unsure about box_id, leave it empty but still provide label, location, summary, and keywords.
JSON fields: suggestedBoxId, suggestedLabel, suggestedLocationId, suggestedSummary, suggestedKeywords, suggestedNotes, confidence, suggestedPhotos.
Always write suggestedSummary, suggestedLabel, and suggestedKeywords in ${langName}.
`,
      images,
      maxTokens: 1400,
      title: "Lagersystem - Box Analysis",
      onProgress
    });

    parsed = parseAnalysisSuggestionResponse(relaxedResponseText);
  }

  const initialSuggestedPhotos =
    Array.isArray(parsed.suggestedPhotos) && parsed.suggestedPhotos.length === assets.length
      ? normalizeSuggestedPhotos(parsed.suggestedPhotos, assets)
      : await inferPhotoRoles(aiConfig, assets, images, onProgress);
  const recoveredSuggestedPhotos = await recoverMissingLabelPhoto(aiConfig, assets, images, initialSuggestedPhotos, onProgress);
  await onProgress?.("Sätter ihop slutligt förslag...");

  return {
    sessionId: buildFallbackSessionId(assets),
    suggestedBoxId: typeof parsed.suggestedBoxId === "string" ? parsed.suggestedBoxId : "",
    suggestedLabel: typeof parsed.suggestedLabel === "string" ? parsed.suggestedLabel : "",
    suggestedLocationId: typeof parsed.suggestedLocationId === "string" ? parsed.suggestedLocationId : "",
    suggestedSummary:
      typeof parsed.suggestedSummary === "string" && parsed.suggestedSummary.trim()
        ? cleanSuggestedBoxSummary(parsed.suggestedSummary, summaryCleanupPrefixes)
        : cleanSuggestedBoxSummary(inferSummaryFromParsed(parsed), summaryCleanupPrefixes),
    suggestedKeywords: Array.isArray(parsed.suggestedKeywords)
      ? sanitizeKeywordList(parsed.suggestedKeywords.filter((item): item is string => typeof item === "string"))
      : [],
    suggestedNotes: cleanSuggestedNotes(parsed.suggestedNotes),
    suggestedPhotos: sortSuggestedPhotos(recoveredSuggestedPhotos),
    confidence:
      parsed.confidence === "high" || parsed.confidence === "medium" || parsed.confidence === "low"
        ? parsed.confidence
        : "medium",
    source: aiConfig.provider,
    matchCandidates: []
  };
}

export async function analyzeSelectedAssets(
  assetIds: string[],
  onProgress?: AiProgressCallback
): Promise<AnalysisSuggestion> {
  await onProgress?.("Hämtar valda bilder och inventariedata...");
  const [allAssets, inventory] = await Promise.all([fetchAlbumAssets(), readInventoryData()]);
  const selectedAssets = allAssets.filter((asset) => assetIds.includes(asset.id));
  const sessionsByBox = getCurrentSessionByBox(inventory);
  const photoCountsBySession = new Map<string, number>();

  for (const photo of inventory.photos) {
    photoCountsBySession.set(photo.sessionId, (photoCountsBySession.get(photo.sessionId) ?? 0) + 1);
  }

  const candidates: CandidateRecord[] = inventory.boxes.map((box) => {
    const session = sessionsByBox.get(box.boxId);
    return { box, session, photoCount: session ? photoCountsBySession.get(session.sessionId) ?? 0 : 0 };
  });

  if (selectedAssets.length === 0) {
    throw new Error("Inga valda Immich-bilder kunde hittas.");
  }

  try {
    const suggestion = await buildAiSuggestion(selectedAssets, candidates, onProgress);
    await onProgress?.("Matchar mot befintliga lådor...");
    return enrichWithMatches(suggestion, candidates);
  } catch (error) {
    const fallback = buildFallbackSuggestion(selectedAssets);
    const reason = describeAnalysisFailure(error);
    fallback.suggestedNotes = [fallback.suggestedNotes, reason].filter(Boolean).join(" ");
    await onProgress?.("AI-analysen misslyckades. Visar ett manuellt utkast.");
    return enrichWithMatches(fallback, candidates);
  }
}
