import { getAiConfig, getImmichConfig } from "@/lib/config";
import { getCurrentSessionByBox, readInventoryData } from "@/lib/data-store";
import { fetchAlbumAssets } from "@/lib/immich";
import { readAppSettingsSync } from "@/lib/settings";
import type { AnalysisSuggestion, BoxRecord, ImmichAsset, PhotoRole, SessionRecord } from "@/lib/types";

type CandidateRecord = {
  box: BoxRecord;
  session?: SessionRecord;
  photoCount: number;
};

type AnalysisProgressCallback = (message: string) => void | Promise<void>;

const AI_REQUEST_TIMEOUT_MS = 90_000;
const AI_MODEL_LOAD_TIMEOUT_MS = 30_000;

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function tokenize(value: string) {
  return normalizeText(value)
    .split(/\s+/)
    .filter((token) => token.length > 1);
}

function sanitizeKeywordList(keywords: string[]) {
  const blocked = new Set([
    "ivar",
    "hylla",
    "plats",
    "the",
    "user",
    "wants",
    "analyze",
    "analyse",
    "analysis",
    "two",
    "images",
    "image",
    "workshop",
    "boxes",
    "storage"
  ]);

  return keywords.filter((keyword) => {
    const token = normalizeText(keyword);
    if (!token) {
      return false;
    }

    if (blocked.has(token)) {
      return false;
    }

    if (/^[a-z]$/.test(token)) {
      return false;
    }

    if (/^\d+$/.test(token)) {
      return false;
    }

    return true;
  });
}

function parseLocationParts(value: string) {
  const match = value.match(/^([A-Z])-H(\d+)-P(\d+)$/i);
  if (!match) {
    return null;
  }

  return {
    shelfSystem: match[1].toUpperCase(),
    shelf: match[2],
    slot: match[3]
  };
}

function parseBoxIdParts(value: string) {
  const match = value.match(/^([A-Z]+)-([A-Z])-H(\d+)-P(\d+)-([A-Z])$/i);
  if (!match) {
    return null;
  }

  return {
    systemName: match[1].toUpperCase(),
    shelfSystem: match[2].toUpperCase(),
    shelf: match[3],
    slot: match[4],
    variant: match[5].toUpperCase()
  };
}

function boxIdMatchesLocation(boxId: string, locationId: string) {
  const boxParts = parseBoxIdParts(boxId);
  const locationParts = parseLocationParts(locationId);

  if (!boxParts || !locationParts) {
    return true;
  }

  return (
    boxParts.shelfSystem === locationParts.shelfSystem &&
    boxParts.shelf === locationParts.shelf &&
    boxParts.slot === locationParts.slot
  );
}

function extractLocationIdFromText(value: string, fallbackShelfSystem = "") {
  const directMatch = value.match(/\b([A-Z])\s*[,.\- ]+\s*Hylla\s*(\d+)\s*[,.\- ]+\s*Plats\s*(\d+)\b/i);
  if (directMatch) {
    return `${directMatch[1].toUpperCase()}-H${directMatch[2]}-P${directMatch[3]}`;
  }

  const systemNameMatch = value.match(/\b(?:Ivar|IVAR|Hylla)\s*([A-Z])\s*[,.\- ]+\s*Hylla\s*(\d+)\s*[,.\- ]+\s*Plats\s*(\d+)\b/i);
  if (systemNameMatch) {
    return `${systemNameMatch[1].toUpperCase()}-H${systemNameMatch[2]}-P${systemNameMatch[3]}`;
  }

  const explicitShelfAndSlotMatch = value.match(/\bHylla\s*(\d+)\s*[,.\- ]+\s*Plats\s*(\d+)\b/i);
  if (explicitShelfAndSlotMatch && fallbackShelfSystem) {
    return `${fallbackShelfSystem.toUpperCase()}-H${explicitShelfAndSlotMatch[1]}-P${explicitShelfAndSlotMatch[2]}`;
  }

  const compactMatch = value.match(/\b([A-Z])\s*-\s*H(\d+)\s*-\s*P(\d+)\b/i);
  if (compactMatch) {
    return `${compactMatch[1].toUpperCase()}-H${compactMatch[2]}-P${compactMatch[3]}`;
  }

  return "";
}

function validateSuggestion(suggestion: AnalysisSuggestion): AnalysisSuggestion {
  let suggestedBoxId = suggestion.suggestedBoxId;
  let suggestedLocationId = suggestion.suggestedLocationId;
  let suggestedNotes = suggestion.suggestedNotes ?? "";
  const fallbackShelfSystem =
    parseLocationParts(suggestedLocationId)?.shelfSystem ??
    parseBoxIdParts(suggestedBoxId)?.shelfSystem ??
    "";
  const ocrLocationId = extractLocationIdFromText(
    [suggestion.suggestedNotes ?? "", suggestion.suggestedSummary ?? "", suggestion.suggestedLabel ?? ""].join(" "),
    fallbackShelfSystem
  );

  if (ocrLocationId && ocrLocationId !== suggestedLocationId) {
    suggestedLocationId = ocrLocationId;
    suggestedNotes = [
      suggestedNotes,
      `Platsen korrigerades från OCR till ${ocrLocationId}.`
    ]
      .filter(Boolean)
      .join(" ");
  }

  if (
    suggestedBoxId &&
    suggestedLocationId &&
    !boxIdMatchesLocation(suggestedBoxId, suggestedLocationId)
  ) {
    suggestedBoxId = "";
    suggestedNotes = [
      suggestedNotes,
      "Föreslaget box-id rensades eftersom det inte matchade den plats som lästes från etiketten."
    ]
      .filter(Boolean)
      .join(" ");
  }

  return {
    ...suggestion,
    suggestedBoxId,
    suggestedLocationId,
    suggestedNotes
  };
}

function buildCatalogContext(candidates: CandidateRecord[]) {
  return candidates
    .map(({ box, session }) => {
      const keywords = (session?.itemKeywords ?? []).join(", ");
      return `${box.boxId} | ${box.currentLocationId} | ${box.label} | ${session?.summary ?? ""} | ${keywords}`;
    })
    .join("\n");
}

function scoreCandidate(candidate: CandidateRecord, suggestion: AnalysisSuggestion) {
  const reasons: string[] = [];
  let score = 0;

  if (suggestion.suggestedBoxId && candidate.box.boxId === suggestion.suggestedBoxId) {
    score += 120;
    reasons.push("box_id matchar exakt");
  }

  if (
    suggestion.suggestedLocationId &&
    candidate.box.currentLocationId.toLowerCase() === suggestion.suggestedLocationId.toLowerCase()
  ) {
    score += 40;
    reasons.push("plats matchar exakt");
  }

  const suggestionLabel = normalizeText(suggestion.suggestedLabel);
  const candidateLabel = normalizeText(candidate.box.label);
  if (suggestionLabel && candidateLabel) {
    if (suggestionLabel === candidateLabel) {
      score += 50;
      reasons.push("etikett matchar exakt");
    } else if (candidateLabel.includes(suggestionLabel) || suggestionLabel.includes(candidateLabel)) {
      score += 24;
      reasons.push("etikett matchar delvis");
    }
  }

  const queryTokens = new Set([
    ...tokenize(suggestion.suggestedLabel),
    ...tokenize(suggestion.suggestedSummary),
    ...suggestion.suggestedKeywords.flatMap((keyword) => tokenize(keyword))
  ]);

  if (queryTokens.size > 0) {
    const candidateTokens = new Set([
      ...tokenize(candidate.box.label),
      ...tokenize(candidate.box.notes ?? ""),
      ...tokenize(candidate.session?.summary ?? ""),
      ...(candidate.session?.itemKeywords ?? []).flatMap((keyword) => tokenize(keyword))
    ]);

    let overlaps = 0;
    for (const token of queryTokens) {
      if (candidateTokens.has(token)) {
        overlaps += 1;
      }
    }

    if (overlaps > 0) {
      score += Math.min(28, overlaps * 6);
      reasons.push(`${overlaps} gemensamma nyckelord`);
    }
  }

  return { score, reasons };
}

function compareVariantLetters(a: string, b: string) {
  return a.localeCompare(b);
}

function getVariantLetter(boxId: string) {
  return parseBoxIdParts(boxId)?.variant ?? "Z";
}

function chooseNextAvailableVariant(candidates: Array<{
  boxId: string;
  label: string;
  currentLocationId: string;
  summary: string;
  score: number;
  reasons: string[];
  photoCount: number;
}>) {
  const sameLocation = [...candidates].sort((a, b) => {
    const variantOrder = compareVariantLetters(getVariantLetter(a.boxId), getVariantLetter(b.boxId));
    if (variantOrder !== 0) {
      return variantOrder;
    }

    return a.boxId.localeCompare(b.boxId);
  });

  const emptyCandidates = sameLocation.filter((candidate) => candidate.photoCount === 0);
  if (emptyCandidates.length === 0) {
    return null;
  }

  const occupiedVariants = new Set(
    sameLocation
      .filter((candidate) => candidate.photoCount > 0)
      .map((candidate) => getVariantLetter(candidate.boxId))
  );

  for (const candidate of emptyCandidates) {
    const variant = getVariantLetter(candidate.boxId);
    const hasEarlierGap = Array.from({ length: Math.max(variant.charCodeAt(0) - 65, 0) }, (_, index) =>
      String.fromCharCode(65 + index)
    ).some((letter) => !occupiedVariants.has(letter));

    if (!hasEarlierGap) {
      return candidate;
    }
  }

  return emptyCandidates[0] ?? null;
}

function enrichWithMatches(
  suggestion: AnalysisSuggestion,
  candidates: CandidateRecord[]
): AnalysisSuggestion {
  const validatedSuggestion = validateSuggestion(suggestion);
  let matchCandidates = candidates
    .map((candidate) => {
      const { score, reasons } = scoreCandidate(candidate, validatedSuggestion);
      return {
        boxId: candidate.box.boxId,
        label: candidate.box.label,
        currentLocationId: candidate.box.currentLocationId,
        summary: candidate.session?.summary ?? "",
        photoCount: candidate.photoCount,
        score,
        reasons
      };
    })
    .filter((candidate) => candidate.score > 0)
    .sort((a, b) => b.score - a.score || a.boxId.localeCompare(b.boxId));

  if (validatedSuggestion.suggestedLocationId) {
    const sameLocationCandidates = matchCandidates.filter(
      (candidate) =>
        candidate.currentLocationId.toLowerCase() === validatedSuggestion.suggestedLocationId.toLowerCase()
    );

    const preferredVariant = chooseNextAvailableVariant(sameLocationCandidates);
    if (preferredVariant) {
      matchCandidates = matchCandidates
        .map((candidate) =>
          candidate.boxId === preferredVariant.boxId
            ? {
                ...candidate,
                score: candidate.score + 35,
                reasons: candidate.reasons.includes("nästa lediga låda på platsen")
                  ? candidate.reasons
                  : ["nästa lediga låda på platsen", ...candidate.reasons]
              }
            : candidate
        )
        .sort((a, b) => b.score - a.score || a.boxId.localeCompare(b.boxId));
    }
  }

  matchCandidates = matchCandidates.slice(0, 5);

  const bestMatch = matchCandidates[0];
  const locationMatchesBestCandidate =
    !!bestMatch &&
    !!validatedSuggestion.suggestedLocationId &&
    bestMatch.currentLocationId.toLowerCase() === validatedSuggestion.suggestedLocationId.toLowerCase();
  const hasStrongBestMatch = !!bestMatch && bestMatch.score >= 70;
  const shouldAdoptBestMatch =
    !!bestMatch &&
    !validatedSuggestion.suggestedBoxId &&
    (hasStrongBestMatch || (bestMatch.score >= 50 && locationMatchesBestCandidate));
  const shouldPopulateFromBestMatch =
    !!bestMatch &&
    (!validatedSuggestion.suggestedLabel || !validatedSuggestion.suggestedLocationId) &&
    (hasStrongBestMatch || locationMatchesBestCandidate);

  return {
    ...validatedSuggestion,
    suggestedBoxId: shouldAdoptBestMatch ? bestMatch.boxId : validatedSuggestion.suggestedBoxId,
    suggestedLabel:
      !validatedSuggestion.suggestedLabel && shouldPopulateFromBestMatch
        ? bestMatch.label
        : validatedSuggestion.suggestedLabel,
    suggestedLocationId:
      !validatedSuggestion.suggestedLocationId && shouldPopulateFromBestMatch
        ? bestMatch.currentLocationId
        : validatedSuggestion.suggestedLocationId,
    matchCandidates
  };
}

function buildFallbackSessionId(assets: ImmichAsset[]) {
  const first = assets[0];
  const stamp = first?.fileCreatedAt ?? new Date().toISOString();
  const compact = stamp.replace(/[-:]/g, "").replace(/\..*/, "").replace("T", "-");
  return `INV-${compact}`;
}

function guessPhotoRoles(assets: ImmichAsset[]) {
  return assets.map((asset, index) => {
    let photoRole: PhotoRole = "detail";
    if (index === 0) photoRole = "label";
    else if (index === 1) photoRole = "inside";
    else if (index === 2) photoRole = "spread";
    return {
      immichAssetId: asset.id,
      photoRole,
      capturedAt: asset.fileCreatedAt
    };
  });
}

function buildFallbackSuggestion(assets: ImmichAsset[]): AnalysisSuggestion {
  const first = assets[0];
  const roles = guessPhotoRoles(assets);

  return {
    sessionId: buildFallbackSessionId(assets),
    suggestedBoxId: "",
    suggestedLabel: "",
    suggestedLocationId: "",
    suggestedSummary:
      "Utkast skapat utan AI-analys. Fyll i etikett, plats och innehåll manuellt.",
    suggestedKeywords: [],
    suggestedNotes: first
      ? `Skapat från ${assets.length} markerade Immich-bilder. Första fil: ${first.originalFileName}.`
      : "Skapat från markerade Immich-bilder.",
    suggestedPhotos: roles,
    confidence: "low",
    source: "fallback",
    matchCandidates: []
  };
}

async function fetchAssetImagePayload(assetId: string) {
  const config = getImmichConfig();
  const url = config.apiKey
    ? `${config.baseUrl}/api/assets/${assetId}/thumbnail`
    : `${config.baseUrl}/api/assets/${assetId}/thumbnail?key=${config.shareKey ?? ""}`;

  const response = await fetch(url, {
    headers: config.apiKey ? { "x-api-key": config.apiKey } : undefined
  });

  if (!response.ok) {
    throw new Error(`Kunde inte hämta thumbnail för ${assetId}.`);
  }

  const contentType = response.headers.get("content-type") ?? "image/jpeg";
  const buffer = Buffer.from(await response.arrayBuffer());
  const base64 = buffer.toString("base64");
  return {
    contentType,
    base64,
    dataUrl: `data:${contentType};base64,${base64}`
  };
}

async function fetchAssetAsDataUrl(assetId: string) {
  const payload = await fetchAssetImagePayload(assetId);
  return payload.dataUrl;
}

async function ensureLmStudioModelLoaded(
  baseUrl: string,
  model: string,
  apiKey?: string,
  contextLength?: number,
  onProgress?: AnalysisProgressCallback
) {
  await onProgress?.("Laddar modell i LM Studio...");
  const rootUrl = baseUrl.endsWith("/v1") ? baseUrl.slice(0, -3) : baseUrl;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), AI_MODEL_LOAD_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(`${rootUrl}/api/v1/models/load`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {})
      },
      body: JSON.stringify({
        model,
        ...(contextLength ? { context_length: contextLength } : {}),
        flash_attention: true,
        offload_kv_cache_to_gpu: true
      }),
      signal: controller.signal
    });
  } catch (error) {
    clearTimeout(timeout);
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("LM Studio hann inte ladda modellen i tid.");
    }
    throw error;
  }

  clearTimeout(timeout);

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`LM Studio kunde inte ladda modellen ${model}: ${response.status} ${errorText}`);
  }
}

async function postResponsesRequest(
  baseUrl: string,
  body: object,
  apiKey?: string,
  onProgress?: AnalysisProgressCallback,
  inFlightMessage = "AI-motorn bearbetar förfrågan..."
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), AI_REQUEST_TIMEOUT_MS);

  try {
    const responsePromise = fetch(`${baseUrl}/responses`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {})
      },
      body: JSON.stringify(body),
      signal: controller.signal
    });
    await onProgress?.(inFlightMessage);
    return await responsePromise;
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
  onProgress?: AnalysisProgressCallback,
  inFlightMessage = "AI-motorn bearbetar förfrågan...",
  extraHeaders?: Record<string, string>
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), AI_REQUEST_TIMEOUT_MS);

  try {
    const responsePromise = fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
        ...(extraHeaders ?? {})
      },
      body: JSON.stringify(body),
      signal: controller.signal
    });
    await onProgress?.(inFlightMessage);
    return await responsePromise;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("AI-modellen svarade inte inom tidsgränsen.");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function sendAiRequest(
  aiConfig: ReturnType<typeof getAiConfig>,
  body: object,
  onProgress?: AnalysisProgressCallback
) {
  if (aiConfig.provider === "anthropic") {
    throw new Error("Anthropic använder ett annat API-flöde.");
  }

  if (aiConfig.provider === "openrouter") {
    await onProgress?.("Kontaktar OpenRouter...");
    const response = await postChatCompletionsRequest(
      aiConfig.baseUrl,
      body,
      aiConfig.apiKey,
      onProgress,
      "OpenRouter bearbetar bilderna...",
      {
        "HTTP-Referer": "https://hylla.snille.net",
        "X-Title": "Hyllsystem"
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`AI-analys misslyckades: ${response.status} ${errorText}`);
    }

    const json = (await response.json()) as unknown;
    await onProgress?.("Tolkar AI-svaret...");
    const responseText = extractChatCompletionsText(json);

    if (!responseText) {
      throw new Error("AI-analys returnerade inget JSON-svar.");
    }

    return responseText;
  }

  await onProgress?.(aiConfig.provider === "lmstudio" ? "Kontaktar LM Studio..." : "Kontaktar AI-motorn...");
  let response = await postResponsesRequest(
    aiConfig.baseUrl,
    body,
    aiConfig.apiKey,
    onProgress,
    aiConfig.provider === "lmstudio" ? "LM Studio bearbetar bilderna..." : "AI-motorn bearbetar förfrågan..."
  );

  if (!response.ok && aiConfig.provider === "lmstudio") {
    const errorText = await response.text();
    if (errorText.includes("Model unloaded")) {
      await ensureLmStudioModelLoaded(
        aiConfig.baseUrl,
        aiConfig.model,
        aiConfig.apiKey,
        aiConfig.contextLength,
        onProgress
      );
      await onProgress?.("Modellen är laddad. Väntar på svar...");
      response = await postResponsesRequest(
        aiConfig.baseUrl,
        body,
        aiConfig.apiKey,
        onProgress,
        "LM Studio bearbetar bilderna..."
      );
    } else {
      throw new Error(`AI-analys misslyckades: ${response.status} ${errorText}`);
    }
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`AI-analys misslyckades: ${response.status} ${errorText}`);
  }

  const json = (await response.json()) as unknown;
  await onProgress?.("Tolkar AI-svaret...");
  const responseText = extractResponseText(json);

  if (!responseText) {
    throw new Error("AI-analys returnerade inget JSON-svar.");
  }

  return responseText;
}

async function sendAnthropicRequest(
  aiConfig: Extract<ReturnType<typeof getAiConfig>, { provider: "anthropic" }>,
  payload: {
    system: string;
    userText: string;
    images: Array<{ contentType: string; base64: string }>;
    maxTokens?: number;
  },
  onProgress?: AnalysisProgressCallback
) {
  await onProgress?.("Kontaktar AI-motorn...");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), AI_REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(`${aiConfig.baseUrl}/v1/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "anthropic-version": "2023-06-01",
        ...(aiConfig.apiKey ? { "x-api-key": aiConfig.apiKey } : {})
      },
      body: JSON.stringify({
        model: aiConfig.model,
        max_tokens: payload.maxTokens ?? 1200,
        system: payload.system,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: payload.userText },
              ...payload.images.map((image) => ({
                type: "image",
                source: {
                  type: "base64",
                  media_type: image.contentType,
                  data: image.base64
                }
              }))
            ]
          }
        ]
      }),
      signal: controller.signal
    });
  } catch (error) {
    clearTimeout(timeout);
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("AI-modellen svarade inte inom tidsgränsen.");
    }
    throw error;
  }

  clearTimeout(timeout);

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`AI-analys misslyckades: ${response.status} ${errorText}`);
  }

  const json = (await response.json()) as { content?: Array<{ type?: string; text?: string }> };
  await onProgress?.("Tolkar AI-svaret...");
  const text = (json.content ?? [])
    .filter((part) => part.type === "text" && typeof part.text === "string")
    .map((part) => part.text ?? "")
    .join("\n")
    .trim();

  if (!text) {
    throw new Error("AI-analys returnerade inget JSON-svar.");
  }

  return text;
}

function extractJsonObject(text: string) {
  const trimmed = text.trim();
  if (!trimmed) {
    return "";
  }

  let startIndex = -1;
  let depth = 0;
  let inString = false;
  let isEscaped = false;

  for (let index = 0; index < trimmed.length; index += 1) {
    const character = trimmed[index];

    if (inString) {
      if (isEscaped) {
        isEscaped = false;
        continue;
      }

      if (character === "\\") {
        isEscaped = true;
        continue;
      }

      if (character === "\"") {
        inString = false;
      }
      continue;
    }

    if (character === "\"") {
      inString = true;
      continue;
    }

    if (character === "{") {
      if (depth === 0) {
        startIndex = index;
      }
      depth += 1;
      continue;
    }

    if (character === "}") {
      if (depth === 0) {
        continue;
      }

      depth -= 1;
      if (depth === 0 && startIndex >= 0) {
        return trimmed.slice(startIndex, index + 1);
      }
    }
  }

  return trimmed;
}

function sanitizeRole(value: string): PhotoRole {
  if (value === "label" || value === "location" || value === "inside" || value === "spread" || value === "detail") {
    return value;
  }
  return "detail";
}

function extractResponseText(json: unknown) {
  if (!json || typeof json !== "object") {
    return "";
  }

  const direct = (json as { output_text?: unknown }).output_text;
  if (typeof direct === "string" && direct.trim()) {
    return direct;
  }

  const output = (json as { output?: unknown }).output;
  if (!Array.isArray(output)) {
    return "";
  }

  const chunks: string[] = [];
  for (const item of output) {
    if (!item || typeof item !== "object") {
      continue;
    }

    const content = (item as { content?: unknown }).content;
    if (!Array.isArray(content)) {
      continue;
    }

    for (const part of content) {
      if (!part || typeof part !== "object") {
        continue;
      }

      const text = (part as { text?: unknown }).text;
      if (typeof text === "string" && text.trim()) {
        chunks.push(text);
      }
    }
  }

  return chunks.join("\n").trim();
}

function extractChatCompletionsText(json: unknown) {
  if (!json || typeof json !== "object") {
    return "";
  }

  const choices = (json as { choices?: unknown }).choices;
  if (!Array.isArray(choices) || choices.length === 0) {
    return "";
  }

  const chunks: string[] = [];
  for (const choice of choices) {
    if (!choice || typeof choice !== "object") {
      continue;
    }

    const message = (choice as { message?: unknown }).message;
    if (!message || typeof message !== "object") {
      continue;
    }

    const content = (message as { content?: unknown }).content;
    if (typeof content === "string" && content.trim()) {
      chunks.push(content);
      continue;
    }

    if (Array.isArray(content)) {
      for (const part of content) {
        if (!part || typeof part !== "object") {
          continue;
        }

        const text = (part as { text?: unknown }).text;
        if (typeof text === "string" && text.trim()) {
          chunks.push(text);
        }
      }
    }
  }

  return chunks.join("\n").trim();
}

function normalizeSuggestedPhotos(
  value: unknown,
  assets: ImmichAsset[]
): AnalysisSuggestion["suggestedPhotos"] {
  if (!Array.isArray(value)) {
    return guessPhotoRoles(assets);
  }

  return value.map((photo, index) => {
    const candidate = photo && typeof photo === "object" ? (photo as Record<string, unknown>) : {};
    const immichAssetId =
      typeof candidate.immichAssetId === "string" && candidate.immichAssetId
        ? candidate.immichAssetId
        : assets[index]?.id ?? assets[0]?.id ?? "";
    const photoRole = sanitizeRole(typeof candidate.photoRole === "string" ? candidate.photoRole : "detail");

    return {
      immichAssetId,
      photoRole,
      capturedAt: assets.find((asset) => asset.id === immichAssetId)?.fileCreatedAt
    };
  });
}

function sortSuggestedPhotos(photos: AnalysisSuggestion["suggestedPhotos"]) {
  const priority: Record<PhotoRole, number> = {
    label: 0,
    location: 1,
    inside: 2,
    spread: 3,
    detail: 4
  };

  return [...photos].sort((a, b) => {
    const roleWeight = priority[a.photoRole] - priority[b.photoRole];
    if (roleWeight !== 0) {
      return roleWeight;
    }

    return (a.capturedAt ?? "").localeCompare(b.capturedAt ?? "");
  });
}

function hasLabelPhoto(photos: AnalysisSuggestion["suggestedPhotos"]) {
  return photos.some((photo) => photo.photoRole === "label");
}

function inferSummaryFromParsed(parsed: {
  suggestedLabel?: string;
  suggestedKeywords?: string[];
  suggestedNotes?: string;
}) {
  const keywords = Array.isArray(parsed.suggestedKeywords)
    ? parsed.suggestedKeywords.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];

  if (typeof parsed.suggestedLabel === "string" && parsed.suggestedLabel.trim() && keywords.length > 0) {
    return `${parsed.suggestedLabel} med ${keywords.slice(0, 5).join(", ")}.`;
  }

  if (typeof parsed.suggestedLabel === "string" && parsed.suggestedLabel.trim()) {
    return `Trolig låda: ${parsed.suggestedLabel}. Gå gärna igenom innehållet manuellt.`;
  }

  if (keywords.length > 0) {
    return `Troliga objekt eller ledtrådar i bilderna: ${keywords.slice(0, 6).join(", ")}.`;
  }

  if (typeof parsed.suggestedNotes === "string" && parsed.suggestedNotes.trim()) {
    return parsed.suggestedNotes;
  }

  return "AI-modellen gav inget tydligt sammanfattningsfält. Gå gärna igenom förslaget manuellt.";
}

function isUsefulSuggestion(parsed: Partial<
  Omit<AnalysisSuggestion, "sessionId" | "source" | "matchCandidates">
>) {
  const summary =
    typeof parsed.suggestedSummary === "string" ? parsed.suggestedSummary.trim() : "";
  const label =
    typeof parsed.suggestedLabel === "string" ? parsed.suggestedLabel.trim() : "";
  const location =
    typeof parsed.suggestedLocationId === "string" ? parsed.suggestedLocationId.trim() : "";
  const keywords = Array.isArray(parsed.suggestedKeywords)
    ? parsed.suggestedKeywords.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];

  return Boolean(label || location || keywords.length > 0 || isUsefulPhotoSummary(summary));
}

function parseSuggestionFromLooseText(
  responseText: string
): Partial<Omit<AnalysisSuggestion, "sessionId" | "source" | "matchCandidates">> {
  const hasReasoningMarkers =
    /\bthe user wants\b/i.test(responseText) ||
    /\bimage analysis\b/i.test(responseText) ||
    /\bcatalog matching\b/i.test(responseText) ||
    /\bconclusion\b/i.test(responseText) ||
    /\bwait, looking closely\b/i.test(responseText);
  const summary = extractNestedSummary(responseText) || (hasReasoningMarkers ? "" : summaryFromLooseText(responseText));
  const locationId = extractLocationIdFromText(responseText);
  const boxIdMatch = responseText.match(/\b[A-Z]+-[A-Z]-H\d+-P\d+-[A-Z]\b/i);
  const labelMatch =
    responseText.match(/\bText on Label:\s*["“]([^"\n”]+)["”]/i) ??
    responseText.match(/\blabel(?: clearly)? says\s*["“]([^"\n”]+)["”]/i) ??
    responseText.match(/\betiketten(?: tydligt)?(?: visar| säger| anger)?\s*["“]([^"\n”]+)["”]/i);
  const suggestedLabel = labelMatch?.[1]?.trim() ?? "";
  const keywordSource = hasReasoningMarkers
    ? [suggestedLabel, summary].filter(Boolean).join(" ")
    : [suggestedLabel, summary, responseText].filter(Boolean).join(" ");

  const keywords = sanitizeKeywordList([
    ...new Set(
      tokenize(keywordSource).filter((token) => token.length > 2)
    )
  ]).slice(0, 8);

  return {
    suggestedBoxId: boxIdMatch?.[0]?.toUpperCase() ?? "",
    suggestedLabel,
    suggestedLocationId: locationId,
    suggestedSummary: cleanPhotoSummary(summary),
    suggestedKeywords: keywords,
    suggestedNotes: "",
    confidence: "low",
    suggestedPhotos: []
  };
}

function parseAnalysisSuggestionResponse(
  responseText: string
): Partial<Omit<AnalysisSuggestion, "sessionId" | "source" | "matchCandidates">> {
  try {
    const parsed = JSON.parse(extractJsonObject(responseText)) as Partial<
      Omit<AnalysisSuggestion, "sessionId" | "source" | "matchCandidates">
    >;

    if (isUsefulSuggestion(parsed)) {
      return parsed;
    }
  } catch {
    // Fall through to loose parsing.
  }

  return parseSuggestionFromLooseText(responseText);
}

function cleanSuggestedNotes(value: unknown) {
  if (typeof value !== "string") {
    return "";
  }

  const cleaned = value
    .split(/\s+/)
    .join(" ")
    .trim()
    .replace(/^Etiketten är tydlig och matchar katalogen\.?\s*/i, "")
    .replace(/^Etiketten matchar katalogen\.?\s*/i, "")
    .replace(/^Matchar katalogen\.?\s*/i, "")
    .trim();

  if (!cleaned) {
    return "";
  }

  const looksLikeReasoning = [
    "matchar katalogen",
    "stämmer överens med katalogen",
    "ocr läser",
    "etiketten anger",
    "innehållet i lådan",
    "vilket stödjer",
    "katalogen anger"
  ].some((pattern) => cleaned.toLowerCase().includes(pattern));

  const looksLikeUncertainty = [
    "osäker",
    "oklart",
    "svårläst",
    "kan vara",
    "troligen",
    "möjligen",
    "eventuellt"
  ].some((pattern) => cleaned.toLowerCase().includes(pattern));

  if (looksLikeReasoning && !looksLikeUncertainty) {
    return "";
  }

  return cleaned;
}

function describeAnalysisFailure(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  const normalized = message.toLowerCase();

  if (normalized.includes("inom tidsgränsen")) {
    return "AI-analysen tog för lång tid och avbröts. Prova igen eller välj färre bilder åt gången.";
  }

  if (normalized.includes("returnerade inget json-svar")) {
    return "AI-modellen svarade, men inte i ett format som appen kunde tolka.";
  }

  if (normalized.includes("kunde inte ladda modellen")) {
    return message;
  }

  if (normalized.includes("model unloaded")) {
    return "AI-modellen var inte laddad när analysen kördes.";
  }

  if (message) {
    return `AI-analysen är inte tillgänglig just nu. ${message}`;
  }

  return "AI-analysen är inte tillgänglig just nu.";
}

async function inferPhotoRoles(
  aiConfig: ReturnType<typeof getAiConfig>,
  assets: ImmichAsset[],
  onProgress?: AnalysisProgressCallback
): Promise<AnalysisSuggestion["suggestedPhotos"]> {
  const settings = readAppSettingsSync();
  const roleResults: AnalysisSuggestion["suggestedPhotos"] = [];
  const rolePrompt = settings.prompts.photoRolePrompt;
  const roleSystemPrompt = settings.prompts.photoRoleSystemPrompt;

  await onProgress?.("Klassificerar bildroller...");

  for (const asset of assets) {
    try {
      const responseText =
        aiConfig.provider === "anthropic"
          ? await sendAnthropicRequest(aiConfig, {
              system: roleSystemPrompt,
              userText: rolePrompt,
              images: [await fetchAssetImagePayload(asset.id)],
              maxTokens: 220
            }, onProgress)
          : aiConfig.provider === "openrouter"
            ? await sendAiRequest(aiConfig, {
                model: aiConfig.model,
                messages: [
                  {
                    role: "user",
                    content: [
                      {
                        type: "text",
                        text: rolePrompt
                      },
                      {
                        type: "image_url",
                        image_url: {
                          url: await fetchAssetAsDataUrl(asset.id)
                        }
                      }
                    ]
                  }
                ]
              }, onProgress)
          : await sendAiRequest(aiConfig, {
              model: aiConfig.model,
              input: [
                {
                  role: "user",
                  content: [
                    {
                      type: "input_text" as const,
                      text: rolePrompt
                    },
                    {
                      type: "input_image" as const,
                      image_url: await fetchAssetAsDataUrl(asset.id),
                      detail: "low" as const
                    }
                  ]
                }
              ],
              text: {
                format: {
                  type: "json_schema",
                  name: "single_photo_role",
                  schema: {
                    type: "object",
                    additionalProperties: false,
                    properties: {
                      photoRole: {
                        type: "string",
                        enum: ["label", "location", "inside", "spread", "detail"]
                      }
                    },
                    required: ["photoRole"]
                  },
                  strict: true
                }
              }
            }, onProgress);
      const parsed = JSON.parse(extractJsonObject(responseText)) as { photoRole?: string };
      roleResults.push({
        immichAssetId: asset.id,
        photoRole: sanitizeRole(parsed.photoRole ?? "detail"),
        capturedAt: asset.fileCreatedAt
      });
    } catch {
      roleResults.push({
        immichAssetId: asset.id,
        photoRole: "detail",
        capturedAt: asset.fileCreatedAt
      });
    }
  }

  return roleResults;
}

async function recoverMissingLabelPhoto(
  aiConfig: ReturnType<typeof getAiConfig>,
  assets: ImmichAsset[],
  currentPhotos: AnalysisSuggestion["suggestedPhotos"],
  onProgress?: AnalysisProgressCallback
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
    ...assets.map(
      (asset, index) =>
        `${index + 1}. immichAssetId=${asset.id}, fileCreatedAt=${asset.fileCreatedAt}, fileName=${asset.originalFileName}`
    )
  ].join("\n");

  try {
    const responseText =
      aiConfig.provider === "anthropic"
        ? await sendAnthropicRequest(aiConfig, {
            system: "Du väljer vilken bild som tydligast visar en lådetikett och svarar endast med JSON.",
            userText: recoveryPrompt,
            images: await Promise.all(assets.map((asset) => fetchAssetImagePayload(asset.id))),
            maxTokens: 260
          }, onProgress)
        : aiConfig.provider === "openrouter"
          ? await sendAiRequest(aiConfig, {
              model: aiConfig.model,
              messages: [
                {
                  role: "user",
                  content: [
                    {
                      type: "text",
                      text: recoveryPrompt
                    },
                    ...(await Promise.all(
                      assets.map(async (asset) => ({
                        type: "image_url",
                        image_url: {
                          url: await fetchAssetAsDataUrl(asset.id)
                        }
                      }))
                    ))
                  ]
                }
              ]
            }, onProgress)
        : await sendAiRequest(aiConfig, {
            model: aiConfig.model,
            input: [
              {
                role: "user",
                content: [
                  {
                    type: "input_text" as const,
                    text: recoveryPrompt
                  },
                  ...(await Promise.all(
                    assets.map(async (asset) => ({
                      type: "input_image" as const,
                      image_url: await fetchAssetAsDataUrl(asset.id),
                      detail: "low" as const
                    }))
                  ))
                ]
              }
            ],
            text: {
              format: {
                type: "json_schema",
                name: "label_photo_recovery",
                schema: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    labelAssetId: { type: "string" }
                  },
                  required: ["labelAssetId"]
                },
                strict: true
              }
            }
          }, onProgress);

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

function cleanPhotoSummary(value: string) {
  return value
    .split(/\s+/)
    .join(" ")
    .replace(/\bOCR läser\b.*$/i, "")
    .replace(/\bmatchar katalogen\b.*$/i, "")
    .replace(/\bkatalogen\b.*$/i, "")
    .trim();
}

function isUsefulPhotoSummary(value: string) {
  const cleaned = value.trim();
  if (!cleaned) {
    return false;
  }

  if (/^[.\u2026\s]+$/.test(cleaned)) {
    return false;
  }

  return /[\p{L}\p{N}]/u.test(cleaned);
}

function summaryFromLooseText(value: string) {
  const cleaned = cleanPhotoSummary(
    value
      .replace(/^```(?:json)?/i, "")
      .replace(/```$/i, "")
      .trim()
  );

  return cleaned.replace(/^\{[\s\S]*\}$/m, "").trim() || cleaned;
}

function extractNestedSummary(value: string) {
  const summaryMatches = [...value.matchAll(/"summary"\s*:\s*"((?:\\.|[^"\\])*)"/g)];
  if (summaryMatches.length > 0) {
    const lastMatch = summaryMatches[summaryMatches.length - 1]?.[1] ?? "";
    try {
      return cleanPhotoSummary(JSON.parse(`"${lastMatch}"`));
    } catch {
      return cleanPhotoSummary(lastMatch.replace(/\\"/g, '"'));
    }
  }

  const fencedJsonMatch = value.match(/```json\s*([\s\S]*?)```/i);
  const jsonCandidates = [
    fencedJsonMatch?.[1],
    ...[...value.matchAll(/\{[\s\S]*?\}/g)].map((match) => match[0])
  ].filter((candidate): candidate is string => Boolean(candidate));

  for (const jsonCandidate of jsonCandidates.reverse()) {
    try {
      const parsed = JSON.parse(jsonCandidate) as { summary?: string };
      if (typeof parsed.summary === "string") {
        return cleanPhotoSummary(parsed.summary);
      }
    } catch {
      continue;
    }
  }

  return "";
}

function parseSinglePhotoSummaryResponse(responseText: string) {
  try {
    const parsed = JSON.parse(extractJsonObject(responseText)) as { summary?: string };
    const summary =
      typeof parsed.summary === "string"
        ? extractNestedSummary(parsed.summary) || cleanPhotoSummary(parsed.summary)
        : "";

    if (isUsefulPhotoSummary(summary)) {
      return cleanPhotoSummary(summary);
    }
  } catch {
    // Fall through to loose parsing.
  }

  const fallbackSummary = extractNestedSummary(responseText) || summaryFromLooseText(responseText);
  const cleaned = cleanPhotoSummary(fallbackSummary);
  return isUsefulPhotoSummary(cleaned) ? cleaned : "";
}

export async function analyzeSinglePhoto(
  assetId: string,
  onProgress?: AnalysisProgressCallback
): Promise<string> {
  const aiConfig = getAiConfig();
  const settings = readAppSettingsSync();

  if (
    (aiConfig.provider === "openai" || aiConfig.provider === "anthropic" || aiConfig.provider === "openrouter") &&
    !aiConfig.apiKey
  ) {
    throw new Error("API-nyckel saknas för vald AI-motor.");
  }
  const summaryPrompt = settings.prompts.photoSummaryPrompt;
  const summarySystemPrompt = settings.prompts.photoSummarySystemPrompt;

  try {
    await onProgress?.("Hämtar bild från Immich...");
    const imagePayload = await fetchAssetImagePayload(assetId);
    const imageInput = {
      type: "input_image" as const,
      image_url: imagePayload.dataUrl,
      detail: "low" as const
    };

    const responseText =
      aiConfig.provider === "anthropic"
        ? await sendAnthropicRequest(aiConfig, {
            system: summarySystemPrompt,
            userText: summaryPrompt,
            images: [imagePayload],
            maxTokens: 260
          }, onProgress)
        : aiConfig.provider === "openrouter"
          ? await sendAiRequest(aiConfig, {
              model: aiConfig.model,
              messages: [
                {
                  role: "user",
                  content: [
                    {
                      type: "text",
                      text: summaryPrompt
                    },
                    {
                      type: "image_url",
                      image_url: {
                        url: imagePayload.dataUrl
                      }
                    }
                  ]
                }
              ]
            }, onProgress)
        : await sendAiRequest(aiConfig, {
            model: aiConfig.model,
            input: [
              {
                role: "user",
                content: [
                  {
                    type: "input_text" as const,
                    text: summaryPrompt
                  },
                  imageInput
                ]
              }
            ],
            text: {
              format: {
                type: "json_schema",
                name: "single_photo_analysis",
                schema: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    summary: { type: "string" }
                  },
                  required: ["summary"]
                },
                strict: true
              }
            }
          }, onProgress);

    await onProgress?.("Tolkar bildanalysen...");
    let summary = parseSinglePhotoSummaryResponse(responseText);

    if (!summary && aiConfig.provider !== "anthropic") {
      await onProgress?.("Första svaret var otydligt. Försöker igen...");
      const relaxedPrompt = `${summaryPrompt}

Var pragmatisk. Svara med ett enda JSON-objekt på formen {"summary":"..."}.
Om du inte kan identifiera allt, skriv ändå en kort svensk beskrivning av det mest synliga i bilden.`;
      const relaxedResponseText = await sendAiRequest(
        aiConfig,
        aiConfig.provider === "openrouter"
          ? {
              model: aiConfig.model,
              messages: [
                {
                  role: "user",
                  content: [
                    {
                      type: "text",
                      text: relaxedPrompt
                    },
                    {
                      type: "image_url",
                      image_url: {
                        url: imagePayload.dataUrl
                      }
                    }
                  ]
                }
              ]
            }
          : {
              model: aiConfig.model,
              input: [
                {
                  role: "user",
                  content: [
                    {
                      type: "input_text" as const,
                      text: relaxedPrompt
                    },
                    imageInput
                  ]
                }
              ]
            },
        onProgress
      );

      summary = parseSinglePhotoSummaryResponse(relaxedResponseText);
    }

    await onProgress?.("Bildanalysen är klar.");
    return summary || "Ingen tydlig bildspecifik beskrivning kunde tas fram.";
  } catch (error) {
    const message = error instanceof Error ? error.message : "Bildspecifik analys misslyckades.";
    throw new Error(`Bildspecifik analys misslyckades. ${message}`);
  }
}

async function buildOpenAiSuggestion(
  assets: ImmichAsset[],
  candidates: CandidateRecord[],
  onProgress?: AnalysisProgressCallback
): Promise<AnalysisSuggestion> {
  const aiConfig = getAiConfig();
  const settings = readAppSettingsSync();

  if (
    (aiConfig.provider === "openai" || aiConfig.provider === "anthropic" || aiConfig.provider === "openrouter") &&
    !aiConfig.apiKey
  ) {
    return buildFallbackSuggestion(assets);
  }

  const schema = {
    name: "inventory_image_analysis",
    schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        suggestedBoxId: { type: "string" },
        suggestedLabel: { type: "string" },
        suggestedLocationId: { type: "string" },
        suggestedSummary: { type: "string" },
        suggestedKeywords: {
          type: "array",
          items: { type: "string" }
        },
        suggestedNotes: { type: "string" },
        confidence: {
          type: "string",
          enum: ["low", "medium", "high"]
        },
        suggestedPhotos: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              immichAssetId: { type: "string" },
              photoRole: {
                type: "string",
                enum: ["label", "location", "inside", "spread", "detail"]
              }
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

  const instructions = settings.prompts.boxAnalysisInstructions;
  await onProgress?.("Förbereder bilder och katalog för analys...");

  const textPart = {
    type: "input_text" as const,
    text: [
      instructions,
      "",
      "Känd katalog:",
      buildCatalogContext(candidates),
      "",
      "Markerade filer:",
      ...assets.map(
        (asset, index) =>
          `${index + 1}. immichAssetId=${asset.id}, fileCreatedAt=${asset.fileCreatedAt}, fileName=${asset.originalFileName}`
      )
    ].join("\n")
  };

  const imageInputs = await Promise.all(
    assets.map(async (asset) => ({
      type: "input_image" as const,
      image_url: await fetchAssetAsDataUrl(asset.id),
      detail: "low" as const
    }))
  );

  const responseText =
    aiConfig.provider === "anthropic"
      ? await sendAnthropicRequest(aiConfig, {
          system: settings.prompts.anthropicBoxSystemPrompt,
          userText: `${textPart.text}\n\nJSON-schema:\n${JSON.stringify(schema.schema)}`,
          images: await Promise.all(assets.map((asset) => fetchAssetImagePayload(asset.id))),
          maxTokens: 1400
        }, onProgress)
      : aiConfig.provider === "openrouter"
        ? await sendAiRequest(aiConfig, {
            model: aiConfig.model,
            messages: [
              {
                role: "user",
                content: [
                  {
                    type: "text",
                    text: textPart.text
                  },
                  ...(await Promise.all(
                    assets.map(async (asset) => ({
                      type: "image_url",
                      image_url: {
                        url: await fetchAssetAsDataUrl(asset.id)
                      }
                    }))
                  ))
                ]
              }
            ]
          }, onProgress)
      : await sendAiRequest(aiConfig, {
          model: aiConfig.model,
          input: [
            {
              role: "user",
              content: [textPart, ...imageInputs]
            }
          ],
          text: {
            format: {
              type: "json_schema",
              name: schema.name,
              schema: schema.schema,
              strict: true
            }
          }
        }, onProgress);

  await onProgress?.("Tolkar översiktsanalysen...");
  let parsed = parseAnalysisSuggestionResponse(responseText);

  if (!isUsefulSuggestion(parsed) && aiConfig.provider !== "anthropic") {
    await onProgress?.("Första svaret var otydligt. Försöker igen med enklare instruktion...");
    const relaxedPrompt = `${instructions}

Svara med ett enda JSON-objekt.
Var pragmatisk: hellre ett kort användbart förslag än tomma fält.
Om du är osäker på box_id, lämna det tomt men försök ändå ge label, plats, summary och keywords.
JSON-fält: suggestedBoxId, suggestedLabel, suggestedLocationId, suggestedSummary, suggestedKeywords, suggestedNotes, confidence, suggestedPhotos.
`;
    const relaxedResponseText = await sendAiRequest(
      aiConfig,
      aiConfig.provider === "openrouter"
        ? {
            model: aiConfig.model,
            messages: [
              {
                role: "user",
                content: [
                  {
                    type: "text",
                    text: relaxedPrompt
                  },
                  ...(await Promise.all(
                    assets.map(async (asset) => ({
                      type: "image_url",
                      image_url: {
                        url: await fetchAssetAsDataUrl(asset.id)
                      }
                    }))
                  ))
                ]
              }
            ]
          }
        : {
            model: aiConfig.model,
            input: [
              {
                role: "user",
                content: [
                  {
                    type: "input_text" as const,
                    text: relaxedPrompt
                  },
                  ...imageInputs
                ]
              }
            ]
          },
      onProgress
    );

    parsed = parseAnalysisSuggestionResponse(relaxedResponseText);
  }

  const initialSuggestedPhotos =
    Array.isArray(parsed.suggestedPhotos) && parsed.suggestedPhotos.length === assets.length
      ? normalizeSuggestedPhotos(parsed.suggestedPhotos, assets)
      : await inferPhotoRoles(aiConfig, assets, onProgress);
  const recoveredSuggestedPhotos = await recoverMissingLabelPhoto(
    aiConfig,
    assets,
    initialSuggestedPhotos,
    onProgress
  );
  await onProgress?.("Sätter ihop slutligt förslag...");
  const suggestedPhotos = sortSuggestedPhotos(recoveredSuggestedPhotos);

  return {
    sessionId: buildFallbackSessionId(assets),
    suggestedBoxId: typeof parsed.suggestedBoxId === "string" ? parsed.suggestedBoxId : "",
    suggestedLabel: typeof parsed.suggestedLabel === "string" ? parsed.suggestedLabel : "",
    suggestedLocationId: typeof parsed.suggestedLocationId === "string" ? parsed.suggestedLocationId : "",
    suggestedSummary:
      typeof parsed.suggestedSummary === "string" && parsed.suggestedSummary.trim()
        ? parsed.suggestedSummary
        : inferSummaryFromParsed(parsed),
    suggestedKeywords: Array.isArray(parsed.suggestedKeywords)
      ? sanitizeKeywordList(parsed.suggestedKeywords.filter((item): item is string => typeof item === "string"))
      : [],
    suggestedNotes: cleanSuggestedNotes(parsed.suggestedNotes),
    suggestedPhotos,
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
  onProgress?: AnalysisProgressCallback
): Promise<AnalysisSuggestion> {
  await onProgress?.("Hämtar valda bilder och inventariedata...");
  const [allAssets, inventory] = await Promise.all([fetchAlbumAssets(), readInventoryData()]);
  const selectedAssets = allAssets.filter((asset) => assetIds.includes(asset.id));
  const sessionsByBox = getCurrentSessionByBox(inventory);
  const photoCountsBySession = new Map<string, number>();

  for (const photo of inventory.photos) {
    photoCountsBySession.set(photo.sessionId, (photoCountsBySession.get(photo.sessionId) ?? 0) + 1);
  }

  const candidates = inventory.boxes.map((box) => ({
    box,
    session: sessionsByBox.get(box.boxId),
    photoCount: sessionsByBox.get(box.boxId)
      ? photoCountsBySession.get(sessionsByBox.get(box.boxId)!.sessionId) ?? 0
      : 0
  }));

  if (selectedAssets.length === 0) {
    throw new Error("Inga valda Immich-bilder kunde hittas.");
  }

  try {
    const suggestion = await buildOpenAiSuggestion(selectedAssets, candidates, onProgress);
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
