import { extractJsonObject } from "@/lib/ai-client";
import { extractLocationIdFromText } from "@/lib/analysis/matching";
import { normalizeText, tokenize } from "@/lib/analysis/text";
import { readAppSettingsSync } from "@/lib/settings";
import type { AnalysisSuggestion, ImmichAsset, PhotoRole } from "@/lib/types";

// Parses and cleans AI replies for photo analysis: JSON extraction with loose-text fallbacks,
// and removal of filler phrases, location codes and generic keywords.

export function parseCleanupLines(value: string) {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim().toLowerCase())
    .filter(Boolean);
}

export function getCleanupPrompts() {
  const prompts = readAppSettingsSync().prompts;
  return {
    summary: parseCleanupLines(prompts.summaryCleanupPrefixes),
    keyword: parseCleanupLines(prompts.keywordCleanupTerms),
    notes: parseCleanupLines(prompts.notesCleanupPhrases),
    photoSummary: parseCleanupLines(prompts.photoSummaryCleanupPhrases)
  };
}

export function sanitizeKeywordList(keywords: string[]) {
  const extraBlocked = getCleanupPrompts().keyword;
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
    "storage",
    ...extraBlocked.map((token) => normalizeText(token)).filter(Boolean)
  ]);

  return keywords.filter((keyword) => {
    const token = normalizeText(keyword);
    if (!token) {
      return false;
    }

    const parts = token.split(/\s+/).filter(Boolean);

    if (blocked.has(token)) {
      return false;
    }

    if (parts.some((part) => blocked.has(part))) {
      return false;
    }

    if (/^[a-z]$/.test(token)) {
      return false;
    }

    if (/^\d+$/.test(token)) {
      return false;
    }

    if (/^[a-z]\s+hylla\s+\d+$/i.test(token)) {
      return false;
    }

    if (/^plats\s+\d+[a-z]?$/i.test(token)) {
      return false;
    }

    if (/^[a-z]\s+hylla\s+\d+\s+plats\s+\d+[a-z]?$/i.test(token)) {
      return false;
    }

    if (/^[a-z]\s+h\d+\s+p\d+[a-z]?$/i.test(token)) {
      return false;
    }

    return true;
  });
}

export function sanitizeRole(value: string): PhotoRole {
  if (value === "label" || value === "location" || value === "inside" || value === "spread" || value === "detail") {
    return value;
  }
  return "detail";
}

export function normalizeSuggestedPhotos(
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

export function sortSuggestedPhotos(photos: AnalysisSuggestion["suggestedPhotos"]) {
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

export function hasLabelPhoto(photos: AnalysisSuggestion["suggestedPhotos"]) {
  return photos.some((photo) => photo.photoRole === "label");
}

export function inferSummaryFromParsed(parsed: {
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

export function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function parseSummaryCleanupPrefixes(value: string) {
  return parseCleanupLines(value);
}

export function cleanSuggestedBoxSummary(value: string, cleanupPrefixes: string[] = []) {
  const cleaned = value
    .split(/\s+/)
    .join(" ")
    .trim()
    .replace(
      /\s*(?:,?\s*|och\s+)(?:placerad|placerat|placerade|märkt)\s+(?:på|i)\s+ivar\s+[a-zåäö]\s*,?\s*hylla\s*\d+\s*,?\s*plats\s*\d+[a-z]?\.?/gi,
      ""
    )
    .replace(
      /\s*(?:,?\s*|och\s+)(?:placerad|placerat|placerade)\s+(?:på|i)\s+[a-zåäö]-?hylla\s*\d+\s*,?\s*plats\s*\d+[a-z]?\.?/gi,
      ""
    )
    .replace(
      /\s*(?:,?\s*|och\s+)(?:på|i)\s+ivar\s+[a-zåäö]\s*,?\s*hylla\s*\d+\s*,?\s*plats\s*\d+[a-z]?\.?/gi,
      ""
    )
    .replace(/\s*,\s*\./g, ".")
    .replace(/\s{2,}/g, " ")
    .trim();

  let result = cleaned;
  for (const prefix of cleanupPrefixes) {
    if (!prefix) {
      continue;
    }

    const escaped = escapeRegex(prefix);
    result = result.replace(
      new RegExp(`\\s*(?:,?\\s*|och\\s+)${escaped}[^.]*\\.?`, "gi"),
      ""
    );
  }

  return result.replace(/[,\s]+$/g, "").trim();
}

export function isUsefulSuggestion(parsed: Partial<
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

export function parseSuggestionFromLooseText(
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
    suggestedSummary: cleanSuggestedBoxSummary(cleanPhotoSummary(summary)),
    suggestedKeywords: keywords,
    suggestedNotes: "",
    confidence: "low",
    suggestedPhotos: []
  };
}

export function parseAnalysisSuggestionResponse(
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

export function cleanSuggestedNotes(value: unknown) {
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

  const dynamicCleanupPhrases = getCleanupPrompts().notes;
  const looksLikeReasoning = [
    "matchar katalogen",
    "stämmer överens med katalogen",
    "ocr läser",
    "etiketten anger",
    "innehållet i lådan",
    "vilket stödjer",
    "katalogen anger",
    ...dynamicCleanupPhrases
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

export function describeAnalysisFailure(error: unknown) {
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

export function cleanPhotoSummary(value: string) {
  let cleaned = value
    .split(/\s+/)
    .join(" ")
    .replace(/\bOCR läser\b.*$/i, "")
    .replace(/\bmatchar katalogen\b.*$/i, "")
    .replace(/\bkatalogen\b.*$/i, "")
    .trim();

  const cleanupPhrases = getCleanupPrompts().photoSummary;
  for (const phrase of cleanupPhrases) {
    if (!phrase) {
      continue;
    }

    const escaped = escapeRegex(phrase);
    cleaned = cleaned.replace(new RegExp(`\\b${escaped}\\b.*$`, "i"), "").trim();
  }

  return cleaned;
}

export function isUsefulPhotoSummary(value: string) {
  const cleaned = value.trim();
  if (!cleaned) {
    return false;
  }

  if (/^[.\u2026\s]+$/.test(cleaned)) {
    return false;
  }

  return /[\p{L}\p{N}]/u.test(cleaned);
}

export function summaryFromLooseText(value: string) {
  const cleaned = cleanPhotoSummary(
    value
      .replace(/^```(?:json)?/i, "")
      .replace(/```$/i, "")
      .trim()
  );

  return cleaned.replace(/^\{[\s\S]*\}$/m, "").trim() || cleaned;
}

export function extractNestedSummary(value: string) {
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

export function parseSinglePhotoSummaryResponse(responseText: string) {
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

/** Role guess by position when the AI gives none: label first, then inside and spread. */
export function guessPhotoRoles(assets: ImmichAsset[]) {
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
