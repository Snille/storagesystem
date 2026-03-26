"use server";

import { redirect } from "next/navigation";
import { readInventoryData, upsertBoxSession } from "@/lib/data-store";
import { buildLocationId, normalizeLocationUnit, parseLocationId } from "@/lib/location-schema";
import type { PhotoRole } from "@/lib/types";

function normalizeComparableText(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

function normalizeList(value: FormDataEntryValue | null) {
  return String(value ?? "")
    .split(/[,\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeLocationId(value: string) {
  const trimmed = value.trim();
  const parsed = parseLocationId(trimmed);
  if (parsed) {
    return parsed.normalizedId;
  }

  const ivarPresentedMatch = trimmed.match(/(?:Ivar|IVAR)\s*:\s*([A-Z]).*?Hylla\s*:?\s*(\d+).*?Plats\s*:?\s*(\d+)\s*([A-Z])?/i);
  if (ivarPresentedMatch) {
    return buildLocationId({
      kind: "ivar",
      unitId: ivarPresentedMatch[1].toUpperCase(),
      rowId: `H${ivarPresentedMatch[2]}`,
      slot: ivarPresentedMatch[3],
      variant: ivarPresentedMatch[4]?.toUpperCase() ?? ""
    });
  }

  const benchPresentedMatch = trimmed.match(/Bänk\s*:\s*([A-Z0-9 -]+).*?Yta\s*:?\s*(Ovanpå|Under).*?Plats\s*:?\s*(\d+)\s*([A-Z])?/i);
  if (benchPresentedMatch) {
    return buildLocationId({
      kind: "bench",
      unitId: normalizeLocationUnit(benchPresentedMatch[1]),
      rowId: benchPresentedMatch[2].toLowerCase().startsWith("o") ? "TOP" : "UNDER",
      slot: benchPresentedMatch[3],
      variant: benchPresentedMatch[4]?.toUpperCase() ?? ""
    });
  }

  const cabinetPresentedMatch = trimmed.match(/Skåp\s*:\s*([A-Z0-9 -]+).*?Hylla\s*:?\s*(\d+).*?Plats\s*:?\s*(\d+)\s*([A-Z])?/i);
  if (cabinetPresentedMatch) {
    return buildLocationId({
      kind: "cabinet",
      unitId: normalizeLocationUnit(cabinetPresentedMatch[1]),
      rowId: `H${cabinetPresentedMatch[2]}`,
      slot: cabinetPresentedMatch[3],
      variant: cabinetPresentedMatch[4]?.toUpperCase() ?? ""
    });
  }

  return trimmed;
}

function extractVariantLetter(value: string) {
  const match = value.match(/Plats\s*:?\s*\d+\s*([A-Z])\b/i);
  return match?.[1]?.toUpperCase() ?? "";
}

function sameLocationBase(left: string, right: string) {
  const parsedLeft = parseLocationId(left);
  const parsedRight = parseLocationId(right);

  if (!parsedLeft || !parsedRight) {
    return left.trim().toLowerCase() === right.trim().toLowerCase();
  }

  return (
    parsedLeft.kind === parsedRight.kind &&
    parsedLeft.unitId === parsedRight.unitId &&
    parsedLeft.rowId === parsedRight.rowId &&
    parsedLeft.slot === parsedRight.slot
  );
}

function sameExactLocation(left: string, right: string) {
  const parsedLeft = parseLocationId(left);
  const parsedRight = parseLocationId(right);

  if (!parsedLeft || !parsedRight) {
    return left.trim().toLowerCase() === right.trim().toLowerCase();
  }

  return parsedLeft.normalizedId === parsedRight.normalizedId;
}

async function generateBoxId(locationId: string, preferredVariant = "") {
  const parsed = parseLocationId(locationId);
  if (!parsed) {
    return "";
  }

  const inventory = await readInventoryData();
  const existingVariants = new Set(
    inventory.boxes
      .filter((box) => sameLocationBase(box.currentLocationId, locationId))
      .map((box) => parseLocationId(box.currentLocationId)?.variant || box.boxId.match(/-([A-Z])$/i)?.[1]?.toUpperCase())
      .filter((variant): variant is string => Boolean(variant))
  );

  const variant =
    (parsed.variant && !existingVariants.has(parsed.variant.toUpperCase()) ? parsed.variant.toUpperCase() : "") ||
    (preferredVariant && !existingVariants.has(preferredVariant) ? preferredVariant : "") ||
    Array.from({ length: 26 }, (_, index) => String.fromCharCode(65 + index)).find(
      (letter) => !existingVariants.has(letter)
    ) ||
    "A";

  if (parsed.kind === "ivar") {
    return `IVAR-${parsed.unitId}-H${parsed.rowId.replace(/^H/i, "")}-P${parsed.slot}-${variant}`;
  }

  if (parsed.kind === "bench") {
    return `BENCH-${parsed.unitId}-${parsed.rowId.toUpperCase()}-P${parsed.slot}-${variant}`;
  }

  return `CABINET-${parsed.unitId}-H${parsed.rowId.replace(/^H/i, "")}-P${parsed.slot}-${variant}`;
}

function generateSessionId() {
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\..*/, "").replace("T", "-");
  return `INV-${stamp}`;
}

function buildNewBoxRedirectUrl(params: {
  boxId: string;
  label: string;
  currentLocationId: string;
  sessionId: string;
  createdAt: string;
  summary: string;
  itemKeywords: string;
  notes: string;
  photoPayload: string;
  duplicateWarning?: string;
}) {
  const search = new URLSearchParams();

  if (params.boxId) search.set("boxId", params.boxId);
  if (params.label) search.set("label", params.label);
  if (params.currentLocationId) search.set("currentLocationId", params.currentLocationId);
  if (params.sessionId) search.set("sessionId", params.sessionId);
  if (params.createdAt) search.set("createdAt", params.createdAt);
  if (params.summary) search.set("summary", params.summary);
  if (params.itemKeywords) search.set("itemKeywords", params.itemKeywords);
  if (params.notes) search.set("notes", params.notes);
  if (params.photoPayload) search.set("photoPayload", params.photoPayload);
  if (params.duplicateWarning) search.set("duplicateWarning", params.duplicateWarning);

  return `/boxes/new?${search.toString()}`;
}

export async function saveBoxSession(formData: FormData) {
  const submittedBoxId = String(formData.get("boxId") ?? "").trim();
  const label = String(formData.get("label") ?? "").trim();
  const currentLocationInput = String(formData.get("currentLocationId") ?? "").trim();
  const currentLocationId = normalizeLocationId(currentLocationInput);
  const summary = String(formData.get("summary") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();
  const submittedSessionId = String(formData.get("sessionId") ?? "").trim();
  const createdAt = String(formData.get("createdAt") ?? "").trim();
  const photoPayloadRaw = String(formData.get("photoPayload") ?? "").trim();

  if (!label || !currentLocationId || !summary) {
    throw new Error("Etikett, aktuell plats och sammanfattning måste anges.");
  }

  const inventory = await readInventoryData();
  const exactLocationConflicts = inventory.boxes.filter((box) => {
    if (submittedBoxId && box.boxId === submittedBoxId) {
      return false;
    }

    return sameExactLocation(box.currentLocationId, currentLocationId);
  });

  if (exactLocationConflicts.length > 0) {
    redirect(
      buildNewBoxRedirectUrl({
        boxId: submittedBoxId,
        label,
        currentLocationId,
        sessionId: submittedSessionId,
        createdAt,
        summary,
        itemKeywords: String(formData.get("itemKeywords") ?? "").trim(),
        notes,
        photoPayload: photoPayloadRaw,
        duplicateWarning:
          exactLocationConflicts.length === 1
            ? `Platsen används redan av ${exactLocationConflicts[0].label} (${exactLocationConflicts[0].boxId}). Välj en annan bokstav eller redigera den befintliga lådan istället.`
            : `Platsen används redan av ${exactLocationConflicts.length} lådor. Välj en annan bokstav eller redigera en befintlig låda istället.`
      })
    );
  }

  const normalizedLabel = normalizeComparableText(label);
  const conflictingBoxes = inventory.boxes.filter((box) => {
    if (submittedBoxId && box.boxId === submittedBoxId) {
      return false;
    }

    return (
      sameExactLocation(box.currentLocationId, currentLocationId) &&
      normalizeComparableText(box.label) === normalizedLabel
    );
  });

  if (conflictingBoxes.length > 0) {
    redirect(
      buildNewBoxRedirectUrl({
        boxId: submittedBoxId,
        label,
        currentLocationId,
        sessionId: submittedSessionId,
        createdAt,
        summary,
        itemKeywords: String(formData.get("itemKeywords") ?? "").trim(),
        notes,
        photoPayload: photoPayloadRaw,
        duplicateWarning:
          conflictingBoxes.length === 1
            ? `Det finns redan en låda med samma namn på den här platsen: ${conflictingBoxes[0].label} (${conflictingBoxes[0].boxId}). Välj en annan bokstav eller redigera den befintliga lådan istället.`
            : `Det finns redan ${conflictingBoxes.length} lådor med samma namn på den här platsen. Välj en annan bokstav eller redigera en befintlig låda istället.`
      })
    );
  }

  const boxId =
    submittedBoxId || (await generateBoxId(currentLocationId, extractVariantLetter(currentLocationInput)));
  const sessionId = submittedSessionId || generateSessionId();

  const photos = photoPayloadRaw
    ? (JSON.parse(photoPayloadRaw) as Array<{
        immichAssetId: string;
        photoRole?: string;
        capturedAt?: string;
        notes?: string;
      }>).map((photo) => ({
        sessionId,
        immichAssetId: photo.immichAssetId,
        photoRole: ((photo.photoRole || "inside") as PhotoRole),
        capturedAt: photo.capturedAt || undefined,
        notes: String(photo.notes ?? "").trim() || undefined
      }))
    : normalizeList(formData.get("photoRows")).map((row) => {
        const [immichAssetId, role, capturedAt] = row.split("|").map((part) => part.trim());
        return {
          sessionId,
          immichAssetId,
          photoRole: (role || "inside") as PhotoRole,
          capturedAt: capturedAt || undefined
        };
      });

  await upsertBoxSession({
    box: {
      boxId,
      label,
      currentLocationId,
      notes: notes || undefined
    },
    session: {
      sessionId,
      boxId,
      createdAt: createdAt || undefined,
      summary,
      notes: notes || undefined,
      itemKeywords: normalizeList(formData.get("itemKeywords"))
    },
    photos
  });

  redirect("/");
}
