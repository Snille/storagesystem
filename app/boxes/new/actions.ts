"use server";

import { redirect } from "next/navigation";
import { readInventoryData, upsertBoxSession } from "@/lib/data-store";
import type { PhotoRole } from "@/lib/types";

function normalizeList(value: FormDataEntryValue | null) {
  return String(value ?? "")
    .split(/[,\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeLocationId(value: string) {
  const trimmed = value.trim();
  const directMatch = trimmed.match(/^([A-Z])-H(\d+)-P(\d+)$/i);
  if (directMatch) {
    return `${directMatch[1].toUpperCase()}-H${directMatch[2]}-P${directMatch[3]}`;
  }

  const presentedMatch = trimmed.match(/(?:Ivar|IVAR)\s*:\s*([A-Z]).*?Hylla\s*:\s*(\d+).*?Plats\s*:\s*(\d+)/i);
  if (presentedMatch) {
    return `${presentedMatch[1].toUpperCase()}-H${presentedMatch[2]}-P${presentedMatch[3]}`;
  }

  return trimmed;
}

function extractVariantLetter(value: string) {
  const match = value.match(/Plats\s*:\s*\d+\s*([A-Z])\b/i);
  return match?.[1]?.toUpperCase() ?? "";
}

async function generateBoxId(locationId: string, preferredVariant = "") {
  const match = locationId.match(/^([A-Z])-H(\d+)-P(\d+)$/i);
  if (!match) {
    return "";
  }

  const [, shelfSystem, shelf, slot] = match;
  const inventory = await readInventoryData();
  const existingVariants = new Set(
    inventory.boxes
      .filter((box) => box.currentLocationId.toLowerCase() === locationId.toLowerCase())
      .map((box) => box.boxId.match(/-([A-Z])$/i)?.[1]?.toUpperCase())
      .filter(Boolean)
  );

  const variant =
    (preferredVariant && !existingVariants.has(preferredVariant) ? preferredVariant : "") ||
    Array.from({ length: 26 }, (_, index) => String.fromCharCode(65 + index)).find(
      (letter) => !existingVariants.has(letter)
    ) ||
    "A";

  return `IVAR-${shelfSystem.toUpperCase()}-H${shelf}-P${slot}-${variant}`;
}

function generateSessionId() {
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\..*/, "").replace("T", "-");
  return `INV-${stamp}`;
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

  if (!label || !currentLocationId || !summary) {
    throw new Error("Etikett, aktuell plats och sammanfattning måste anges.");
  }

  const boxId =
    submittedBoxId || (await generateBoxId(currentLocationId, extractVariantLetter(currentLocationInput)));
  const sessionId = submittedSessionId || generateSessionId();

  const photoPayloadRaw = String(formData.get("photoPayload") ?? "").trim();
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
