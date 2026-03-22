import { getCurrentSessionByBox } from "@/lib/data-store";
import type { BoxRecord, InventoryData, PhotoRecord, SessionRecord } from "@/lib/types";

export type SearchResult = {
  box: BoxRecord;
  session?: SessionRecord;
  photos: PhotoRecord[];
  score: number;
};

type BoxSearchContext = {
  box: BoxRecord;
  session?: SessionRecord;
  sessionPhotos: PhotoRecord[];
  allPhotos: PhotoRecord[];
  photoFileNames: string[];
  allPhotoFileNames: string[];
};

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9åäö]+/g, " ")
    .trim();
}

function tokenize(value: string) {
  const stopWords = new Set([
    "var",
    "finns",
    "finnsdet",
    "vilka",
    "vilken",
    "vilket",
    "jag",
    "behöver",
    "har",
    "den",
    "det",
    "de",
    "en",
    "ett",
    "och",
    "eller",
    "med",
    "i",
    "pa",
    "på",
    "av",
    "till",
    "om"
  ]);

  return normalizeText(value)
    .split(/\s+/)
    .filter((token) => token.length > 1 && !stopWords.has(token));
}

function normalizeFilenameForMatch(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function looksLikeFileNameQuery(value: string) {
  return /[._-]/.test(value) || /\.[a-z0-9]{2,4}$/i.test(value) || /^[a-z]{2,}\d/i.test(value);
}

function getTokenVariants(token: string) {
  const variants = new Set<string>([token]);
  const endings = ["orna", "arna", "erna", "ande", "ning", "ningar", "heten", "heter", "na", "en", "et", "or", "ar", "er", "a", "n", "t"];

  for (const ending of endings) {
    if (token.length > ending.length + 2 && token.endsWith(ending)) {
      variants.add(token.slice(0, -ending.length));
    }
  }

  return [...variants].filter((value) => value.length > 1);
}

export function searchInventory(data: InventoryData, query: string, assetFileNamesById?: Map<string, string>) {
  const normalized = normalizeText(query);
  const queryTokens = tokenize(query);
  const queryTokenVariants = [...new Set(queryTokens.flatMap((token) => getTokenVariants(token)))];
  const normalizedFileQuery = normalizeFilenameForMatch(query);
  const fileNameQuery = looksLikeFileNameQuery(query);

  if (!normalized && queryTokens.length === 0) {
    return [];
  }

  const sessionsByBox = getCurrentSessionByBox(data);
  const sessionsById = new Map(data.sessions.map((session) => [session.sessionId, session]));
  const contexts: BoxSearchContext[] = data.boxes.map((box) => {
    const session = sessionsByBox.get(box.boxId);
    const sessionPhotos = data.photos.filter((photo) => photo.sessionId === session?.sessionId);
    const allPhotos = data.photos.filter((photo) => sessionsById.get(photo.sessionId)?.boxId === box.boxId);
    const photoFileNames = sessionPhotos.map((photo) => assetFileNamesById?.get(photo.immichAssetId) ?? "");
    const allPhotoFileNames = allPhotos.map((photo) => assetFileNamesById?.get(photo.immichAssetId) ?? "");

    return {
      box,
      session,
      sessionPhotos,
      allPhotos,
      photoFileNames,
      allPhotoFileNames
    };
  });

  if (fileNameQuery && normalizedFileQuery) {
    const exactFileMatches = contexts
      .filter((context) =>
        context.allPhotoFileNames.some(
          (fileName) => fileName && normalizeFilenameForMatch(fileName) === normalizedFileQuery
        )
      )
      .map<SearchResult>((context) => ({
        box: context.box,
        session: context.session,
        photos: context.sessionPhotos,
        score: 10_000
      }));

    if (exactFileMatches.length > 0) {
      return exactFileMatches.sort((a, b) => a.box.boxId.localeCompare(b.box.boxId));
    }

    const partialFileMatches = contexts
      .filter((context) =>
        context.allPhotoFileNames.some(
          (fileName) => fileName && normalizeFilenameForMatch(fileName).includes(normalizedFileQuery)
        )
      )
      .map<SearchResult>((context) => ({
        box: context.box,
        session: context.session,
        photos: context.sessionPhotos,
        score: 5_000
      }));

    return partialFileMatches.sort((a, b) => b.score - a.score || a.box.boxId.localeCompare(b.box.boxId));
  }

  const results: SearchResult[] = [];

  for (const { box, session, sessionPhotos, photoFileNames } of contexts) {
    const haystackRaw = [
      box.boxId,
      box.label,
      box.currentLocationId,
      box.notes ?? "",
      session?.summary ?? "",
      session?.notes ?? "",
      ...(session?.itemKeywords ?? []),
      ...sessionPhotos.map((photo) => photo.notes ?? ""),
      ...photoFileNames
    ].join(" ");
    const haystack = normalizeText(haystackRaw);

    const overlaps = queryTokenVariants.filter((token) => haystack.includes(token));
    const fullPhraseMatch = normalized && haystack.includes(normalized);

    if (!fullPhraseMatch && overlaps.length === 0) {
      continue;
    }

    let score = overlaps.length;
    if (fullPhraseMatch) score += 3;

    const labelNormalized = normalizeText(box.label);
    const locationNormalized = normalizeText(box.currentLocationId);
    const summaryNormalized = normalizeText(session?.summary ?? "");
    const keywordsNormalized = (session?.itemKeywords ?? []).map((item) => normalizeText(item));
    const photoNotesNormalized = sessionPhotos.map((photo) => normalizeText(photo.notes ?? ""));
    const fileNamesNormalized = photoFileNames.map((value) => normalizeText(value));
    const rawFileNamesNormalized = photoFileNames.map((value) => normalizeFilenameForMatch(value));

    if (normalized && labelNormalized.includes(normalized)) score += 6;
    if (normalized && locationNormalized.includes(normalized)) score += 3;
    if (normalized && keywordsNormalized.some((item) => item.includes(normalized))) score += 7;
    if (normalized && summaryNormalized.includes(normalized)) score += 4;
    if (normalized && photoNotesNormalized.some((item) => item.includes(normalized))) score += 3;
    if (normalized && fileNamesNormalized.some((item) => item.includes(normalized))) score += 8;
    if (fileNameQuery && normalizedFileQuery && rawFileNamesNormalized.some((item) => item.includes(normalizedFileQuery))) {
      score += 20;
    }

    for (const token of queryTokenVariants) {
      if (labelNormalized.includes(token)) score += 3;
      if (keywordsNormalized.some((item) => item.includes(token))) score += 3;
      if (summaryNormalized.includes(token)) score += 2;
      if (photoNotesNormalized.some((item) => item.includes(token))) score += 1;
      if (fileNamesNormalized.some((item) => item.includes(token))) score += 4;
    }

    results.push({
      box,
      session,
      photos: sessionPhotos,
      score
    });
  }

  return results.sort((a, b) => b.score - a.score || a.box.boxId.localeCompare(b.box.boxId));
}
