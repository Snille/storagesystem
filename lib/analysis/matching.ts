import { normalizeText, tokenize } from "@/lib/analysis/text";
import { buildLocationId, normalizeLocationUnit, parseBoxId, parseLocationId } from "@/lib/location-schema";
import { presentLocation } from "@/lib/location-presentation";
import type { AnalysisSuggestion, BoxRecord, SessionRecord } from "@/lib/types";

// Matches an AI suggestion against boxes already in the inventory: validates location IDs,
// scores candidates and picks the next free variant letter for a new box.

export type CandidateRecord = {
  box: BoxRecord;
  session?: SessionRecord;
  photoCount: number;
};

export function boxIdMatchesLocation(boxId: string, locationId: string) {
  const boxParts = parseBoxId(boxId);
  const locationParts = parseLocationId(locationId);

  if (!boxParts || !locationParts) {
    return true;
  }

  return (
    boxParts.kind === locationParts.kind &&
    boxParts.unitId === locationParts.unitId &&
    boxParts.rowId === locationParts.rowId &&
    boxParts.slot === locationParts.slot
  );
}

export function sameNormalizedLocation(left: string, right: string) {
  const parsedLeft = parseLocationId(left);
  const parsedRight = parseLocationId(right);

  if (parsedLeft && parsedRight) {
    return parsedLeft.normalizedId === parsedRight.normalizedId;
  }

  return left.trim().toLowerCase() === right.trim().toLowerCase();
}

export function extractLocationIdFromText(
  value: string,
  fallback?: { kind?: "ivar" | "bench" | "cabinet"; unitId?: string }
) {
  const directMatch = value.match(/\b([A-Z])\s*[,.\- ]+\s*Hylla\s*(\d+)\s*[,.\- ]+\s*Plats\s*(\d+)\b/i);
  if (directMatch) {
    return buildLocationId({
      kind: "ivar",
      unitId: directMatch[1].toUpperCase(),
      rowId: `H${directMatch[2]}`,
      slot: directMatch[3]
    });
  }

  const systemNameMatch = value.match(/\b(?:Ivar|IVAR|Hylla)\s*([A-Z])\s*[,.\- ]+\s*Hylla\s*(\d+)\s*[,.\- ]+\s*Plats\s*(\d+)\b/i);
  if (systemNameMatch) {
    return buildLocationId({
      kind: "ivar",
      unitId: systemNameMatch[1].toUpperCase(),
      rowId: `H${systemNameMatch[2]}`,
      slot: systemNameMatch[3]
    });
  }

  const cabinetMatch = value.match(/\bSkåp\s*[: ]\s*([A-Z0-9ÅÄÖ -]+).*?Hylla\s*(\d+)\s*[,.\- ]+\s*Plats\s*(\d+)\s*([A-Z])?\b/i);
  if (cabinetMatch) {
    return buildLocationId({
      kind: "cabinet",
      unitId: normalizeLocationUnit(cabinetMatch[1]),
      rowId: `H${cabinetMatch[2]}`,
      slot: cabinetMatch[3],
      variant: cabinetMatch[4]?.toUpperCase() ?? ""
    });
  }

  const benchMatch = value.match(/\bBänk\s*[: ]\s*([A-Z0-9ÅÄÖ -]+).*?(?:Yta\s*:?\s*)?(Ovanpå|Under).*?Plats\s*(\d+)\s*([A-Z])?\b/i);
  if (benchMatch) {
    return buildLocationId({
      kind: "bench",
      unitId: normalizeLocationUnit(benchMatch[1]),
      rowId: benchMatch[2].toLowerCase().startsWith("o") ? "TOP" : "UNDER",
      slot: benchMatch[3],
      variant: benchMatch[4]?.toUpperCase() ?? ""
    });
  }

  const explicitShelfAndSlotMatch = value.match(/\bHylla\s*(\d+)\s*[,.\- ]+\s*Plats\s*(\d+)\s*([A-Z])?\b/i);
  if (explicitShelfAndSlotMatch && fallback?.kind && fallback?.unitId && fallback.kind !== "bench") {
    return buildLocationId({
      kind: fallback.kind,
      unitId: fallback.unitId,
      rowId: `H${explicitShelfAndSlotMatch[1]}`,
      slot: explicitShelfAndSlotMatch[2],
      variant: explicitShelfAndSlotMatch[3]?.toUpperCase() ?? ""
    });
  }

  const explicitBenchMatch = value.match(/\b(?:Yta\s*:?\s*)?(Ovanpå|Under)\s*[,.\- ]+\s*Plats\s*(\d+)\s*([A-Z])?\b/i);
  if (explicitBenchMatch && fallback?.kind === "bench" && fallback.unitId) {
    return buildLocationId({
      kind: "bench",
      unitId: fallback.unitId,
      rowId: explicitBenchMatch[1].toLowerCase().startsWith("o") ? "TOP" : "UNDER",
      slot: explicitBenchMatch[2],
      variant: explicitBenchMatch[3]?.toUpperCase() ?? ""
    });
  }

  const compactMatch = value.match(/\b([A-Z])\s*-\s*H(\d+)\s*-\s*P(\d+)\b/i);
  if (compactMatch) {
    return buildLocationId({
      kind: "ivar",
      unitId: compactMatch[1].toUpperCase(),
      rowId: `H${compactMatch[2]}`,
      slot: compactMatch[3]
    });
  }

  return "";
}

export function validateSuggestion(suggestion: AnalysisSuggestion): AnalysisSuggestion {
  let suggestedBoxId = suggestion.suggestedBoxId;
  let suggestedLocationId = suggestion.suggestedLocationId;
  let suggestedNotes = suggestion.suggestedNotes ?? "";
  const parsedSuggestedLocation = parseLocationId(suggestedLocationId);
  if (parsedSuggestedLocation) {
    suggestedLocationId = parsedSuggestedLocation.normalizedId;
  }

  const fallbackLocation = parsedSuggestedLocation ?? parseBoxId(suggestedBoxId);
  const ocrLocationId = extractLocationIdFromText(
    [suggestion.suggestedNotes ?? "", suggestion.suggestedSummary ?? "", suggestion.suggestedLabel ?? ""].join(" "),
    fallbackLocation
      ? {
          kind: fallbackLocation.kind,
          unitId: fallbackLocation.unitId
        }
      : undefined
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

export function buildCatalogContext(candidates: CandidateRecord[]) {
  return candidates
    .map(({ box, session }) => {
      const keywords = (session?.itemKeywords ?? []).join(", ");
      const presented = presentLocation(box.currentLocationId, box.boxId);
      const humanReadableLocation = [presented.system, presented.shelf, presented.slot].filter(Boolean).join(", ");
      return `${box.boxId} | ${box.currentLocationId} | ${humanReadableLocation} | ${box.label} | ${session?.summary ?? ""} | ${keywords}`;
    })
    .join("\n");
}

export function scoreCandidate(candidate: CandidateRecord, suggestion: AnalysisSuggestion) {
  const reasons: string[] = [];
  let score = 0;

  if (suggestion.suggestedBoxId && candidate.box.boxId === suggestion.suggestedBoxId) {
    score += 120;
    reasons.push("box_id matchar exakt");
  }

  if (
    suggestion.suggestedLocationId &&
    sameNormalizedLocation(candidate.box.currentLocationId, suggestion.suggestedLocationId)
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

export function compareVariantLetters(a: string, b: string) {
  return a.localeCompare(b);
}

export function getVariantLetter(boxId: string) {
  return parseBoxId(boxId)?.variant ?? "Z";
}

export function chooseNextAvailableVariant(candidates: Array<{
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

export function enrichWithMatches(
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
        sameNormalizedLocation(candidate.currentLocationId, validatedSuggestion.suggestedLocationId)
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
    sameNormalizedLocation(bestMatch.currentLocationId, validatedSuggestion.suggestedLocationId);
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
