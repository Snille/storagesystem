import { promises as fs } from "node:fs";
import path from "node:path";
import { z } from "zod";
import type { BoxRecord, InventoryData, PhotoRecord, SessionRecord } from "@/lib/types";

export const inventorySchema = z.object({
  boxes: z.array(
    z.object({
      boxId: z.string(),
      label: z.string(),
      currentLocationId: z.string(),
      notes: z.string().optional(),
      createdAt: z.string(),
      updatedAt: z.string()
    })
  ),
  sessions: z.array(
    z.object({
      sessionId: z.string(),
      boxId: z.string(),
      createdAt: z.string(),
      summary: z.string(),
      itemKeywords: z.array(z.string()),
      notes: z.string().optional(),
      isCurrent: z.boolean()
    })
  ),
  photos: z.array(
    z.object({
      photoId: z.string(),
      sessionId: z.string(),
      immichAssetId: z.string(),
      photoRole: z.enum(["label", "location", "inside", "spread", "detail"]),
      capturedAt: z.string().optional(),
      notes: z.string().optional()
    })
  )
});

const dataFilePath = path.join(process.cwd(), "data", "inventory.json");

async function ensureDataFile() {
  await fs.mkdir(path.dirname(dataFilePath), { recursive: true });
  try {
    await fs.access(dataFilePath);
  } catch {
    await fs.writeFile(dataFilePath, JSON.stringify({ boxes: [], sessions: [], photos: [] }, null, 2), "utf8");
  }
}

export async function readInventoryData(): Promise<InventoryData> {
  await ensureDataFile();
  const raw = await fs.readFile(dataFilePath, "utf8");
  return inventorySchema.parse(JSON.parse(raw));
}

export async function writeInventoryData(data: InventoryData) {
  await ensureDataFile();
  const validated = inventorySchema.parse(data);
  await fs.writeFile(dataFilePath, JSON.stringify(validated, null, 2), "utf8");
}

export async function appendPhotosToSession(payload: {
  boxId: string;
  sessionId: string;
  photos: Array<Omit<PhotoRecord, "photoId" | "sessionId">>;
}) {
  const data = await readInventoryData();
  const box = data.boxes.find((entry) => entry.boxId === payload.boxId);
  const session = data.sessions.find((entry) => entry.sessionId === payload.sessionId && entry.boxId === payload.boxId);

  if (!box || !session) {
    throw new Error("Kunde inte hitta låda eller aktuell session.");
  }

  const usedAssetIds = new Set(data.photos.map((photo) => photo.immichAssetId));
  const existingPhotos = data.photos.filter((photo) => photo.sessionId === payload.sessionId);
  let nextIndex = existingPhotos.length;

  for (const photo of payload.photos) {
    if (usedAssetIds.has(photo.immichAssetId)) {
      continue;
    }

    nextIndex += 1;
    data.photos.push({
      photoId: `${payload.sessionId}:${nextIndex}`,
      sessionId: payload.sessionId,
      immichAssetId: photo.immichAssetId,
      photoRole: photo.photoRole,
      capturedAt: photo.capturedAt,
      notes: photo.notes
    });
    usedAssetIds.add(photo.immichAssetId);
  }

  box.updatedAt = new Date().toISOString();
  await writeInventoryData(data);
}

export async function updatePhotoNotes(payload: { photoId: string; notes: string }) {
  const data = await readInventoryData();
  const photo = data.photos.find((entry) => entry.photoId === payload.photoId);

  if (!photo) {
    throw new Error("Kunde inte hitta bilden i inventariet.");
  }

  photo.notes = payload.notes;
  await writeInventoryData(data);
}

export async function removePhotoFromSession(photoId: string) {
  const data = await readInventoryData();
  const index = data.photos.findIndex((entry) => entry.photoId === photoId);

  if (index < 0) {
    throw new Error("Kunde inte hitta bilden i inventariet.");
  }

  data.photos.splice(index, 1);
  await writeInventoryData(data);
}

export async function upsertBoxSession(payload: {
  box: Omit<BoxRecord, "createdAt" | "updatedAt">;
  session: Omit<SessionRecord, "createdAt" | "isCurrent"> & { createdAt?: string };
  photos: Array<Omit<PhotoRecord, "photoId">>;
}) {
  const data = await readInventoryData();
  const now = new Date().toISOString();

  const existingBox = data.boxes.find((box) => box.boxId === payload.box.boxId);
  if (existingBox) {
    existingBox.label = payload.box.label;
    existingBox.currentLocationId = payload.box.currentLocationId;
    existingBox.notes = payload.box.notes;
    existingBox.updatedAt = now;
  } else {
    data.boxes.push({ ...payload.box, createdAt: now, updatedAt: now });
  }

  const existingSession = data.sessions.find((session) => session.sessionId === payload.session.sessionId);

  for (const session of data.sessions) {
    if (session.boxId === payload.box.boxId) {
      session.isCurrent = false;
    }
  }

  const createdAt = existingSession?.createdAt ?? payload.session.createdAt ?? now;
  if (existingSession) {
    existingSession.boxId = payload.session.boxId;
    existingSession.createdAt = createdAt;
    existingSession.summary = payload.session.summary;
    existingSession.notes = payload.session.notes;
    existingSession.itemKeywords = payload.session.itemKeywords;
    existingSession.isCurrent = true;
  } else {
    data.sessions.push({ ...payload.session, createdAt, isCurrent: true });
  }

  data.photos = data.photos.filter((photo) => photo.sessionId !== payload.session.sessionId);
  data.photos.push(
    ...payload.photos.map((photo, index) => ({
      ...photo,
      photoId: `${payload.session.sessionId}:${index + 1}`
    }))
  );

  await writeInventoryData(data);
}

export function getCurrentSessionByBox(data: InventoryData) {
  const sessionsByBox = new Map<string, SessionRecord>();
  const photoCounts = new Map<string, number>();

  for (const photo of data.photos) {
    photoCounts.set(photo.sessionId, (photoCounts.get(photo.sessionId) ?? 0) + 1);
  }

  for (const box of data.boxes) {
    const sessions = data.sessions
      .filter((session) => session.boxId === box.boxId)
      .sort((a, b) => {
        const currentWeight = Number(b.isCurrent) - Number(a.isCurrent);
        if (currentWeight !== 0) return currentWeight;

        const photoWeight = (photoCounts.get(b.sessionId) ?? 0) - (photoCounts.get(a.sessionId) ?? 0);
        if (photoWeight !== 0) return photoWeight;

        return b.createdAt.localeCompare(a.createdAt);
      });

    if (sessions[0]) {
      sessionsByBox.set(box.boxId, sessions[0]);
    }
  }
  return sessionsByBox;
}
