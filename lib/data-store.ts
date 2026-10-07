import { promises as fs } from "node:fs";
import { z } from "zod";
import { createFileCache, dataFilePath, fileStamp, withFileLock, writeFileAtomic } from "@/lib/json-file";
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

const INVENTORY_LOCK = "inventory";
const inventoryCache = createFileCache<InventoryData>();

function getInventoryFilePath() {
  return dataFilePath("inventory.json");
}

function getHighestPhotoIndexForSession(photos: Array<Pick<PhotoRecord, "photoId" | "sessionId">>, sessionId: string) {
  return photos.reduce((highest, photo) => {
    if (photo.sessionId !== sessionId) {
      return highest;
    }

    const match = photo.photoId.match(new RegExp(`^${sessionId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}:(\\d+)$`));
    const index = match ? Number(match[1]) : 0;
    return Number.isFinite(index) ? Math.max(highest, index) : highest;
  }, 0);
}

async function readInventoryFromDisk(): Promise<InventoryData> {
  const filePath = getInventoryFilePath();
  const stamp = await fileStamp(filePath);
  if (!stamp) {
    return { boxes: [], sessions: [], photos: [] };
  }

  const cached = inventoryCache.get(filePath, stamp);
  if (cached) {
    return cached;
  }

  const raw = await fs.readFile(filePath, "utf8");
  const data = inventorySchema.parse(JSON.parse(raw));
  inventoryCache.set(filePath, stamp, data);
  return structuredClone(data);
}

async function writeInventoryToDisk(data: InventoryData) {
  const filePath = getInventoryFilePath();
  const validated = inventorySchema.parse(data);
  await writeFileAtomic(filePath, JSON.stringify(validated, null, 2));
  inventoryCache.set(filePath, await fileStamp(filePath), validated);
}

/** Returns a private copy of the inventory; changing it does not change the file. */
export async function readInventoryData(): Promise<InventoryData> {
  return readInventoryFromDisk();
}

/** Replaces the whole inventory, waiting for any change already in progress. */
export async function writeInventoryData(data: InventoryData) {
  await withFileLock(INVENTORY_LOCK, () => writeInventoryToDisk(data));
}

/**
 * Reads, changes and writes the inventory as one step. No other change can slip in
 * between the read and the write, so concurrent saves never overwrite each other.
 */
export async function updateInventoryData<T>(mutate: (data: InventoryData) => T | Promise<T>): Promise<T> {
  return withFileLock(INVENTORY_LOCK, async () => {
    const data = await readInventoryFromDisk();
    const result = await mutate(data);
    await writeInventoryToDisk(data);
    return result;
  });
}

/** Runs work that changes inventory.json outside this module (for example the catalog import script). */
export async function withInventoryLock<T>(task: () => Promise<T>): Promise<T> {
  return withFileLock(INVENTORY_LOCK, async () => {
    try {
      return await task();
    } finally {
      inventoryCache.clear();
    }
  });
}

export async function appendPhotosToSession(payload: {
  boxId: string;
  sessionId: string;
  photos: Array<Omit<PhotoRecord, "photoId" | "sessionId">>;
}) {
  await updateInventoryData((data) => {
    const box = data.boxes.find((entry) => entry.boxId === payload.boxId);
    const session = data.sessions.find((entry) => entry.sessionId === payload.sessionId && entry.boxId === payload.boxId);

    if (!box || !session) {
      throw new Error("Kunde inte hitta låda eller aktuell session.");
    }

    const usedAssetIds = new Set(data.photos.map((photo) => photo.immichAssetId));
    let nextIndex = getHighestPhotoIndexForSession(data.photos, payload.sessionId);

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
  });
}

export async function updatePhotoNotes(payload: { photoId: string; notes: string }) {
  await updateInventoryData((data) => {
    const photo = data.photos.find((entry) => entry.photoId === payload.photoId);

    if (!photo) {
      throw new Error("Kunde inte hitta bilden i inventariet.");
    }

    photo.notes = payload.notes;
  });
}

export async function removePhotoFromSession(photoId: string) {
  await updateInventoryData((data) => {
    const index = data.photos.findIndex((entry) => entry.photoId === photoId);

    if (index < 0) {
      throw new Error("Kunde inte hitta bilden i inventariet.");
    }

    data.photos.splice(index, 1);
  });
}

export async function deleteBoxCascade(boxId: string) {
  await updateInventoryData((data) => {
    const box = data.boxes.find((entry) => entry.boxId === boxId);

    if (!box) {
      throw new Error("Kunde inte hitta lådan i inventariet.");
    }

    const sessionIds = new Set(
      data.sessions
        .filter((session) => session.boxId === boxId)
        .map((session) => session.sessionId)
    );

    data.boxes = data.boxes.filter((entry) => entry.boxId !== boxId);
    data.sessions = data.sessions.filter((session) => session.boxId !== boxId);
    data.photos = data.photos.filter((photo) => !sessionIds.has(photo.sessionId));

  });
}

export async function upsertBoxSession(payload: {
  box: Omit<BoxRecord, "createdAt" | "updatedAt">;
  session: Omit<SessionRecord, "createdAt" | "isCurrent"> & { createdAt?: string };
  photos: Array<Omit<PhotoRecord, "photoId">>;
}) {
  await updateInventoryData((data) => {
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

  });
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
