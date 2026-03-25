import { getCurrentSessionByBox } from "@/lib/data-store";
import { parseBoxId, parseLocationId, type LocationKind, type ParsedLocation } from "@/lib/location-schema";
import { compareParsedLocations } from "@/lib/location-sort";
import type { BoxRecord, InventoryData, PhotoRecord, SessionRecord } from "@/lib/types";

export type ShelfBoxEntry = {
  box: BoxRecord;
  session?: SessionRecord;
  photos: PhotoRecord[];
  location: ParsedLocation;
};

export type ShelfPosition = {
  rowId: string;
  rowLabel: string;
  rowSortKey: number;
  slot: string;
  slotSortKey: number;
  boxes: ShelfBoxEntry[];
};

export type ShelfUnit = {
  kind: LocationKind;
  unitId: string;
  unitLabel: string;
  slug: string;
  title: string;
  boxes: ShelfBoxEntry[];
  positions: ShelfPosition[];
  rows: Array<{ rowId: string; rowLabel: string; rowSortKey: number }>;
  slots: string[];
};

function parseBoxLocation(box: BoxRecord) {
  return parseLocationId(box.currentLocationId) ?? parseBoxId(box.boxId);
}

function getUnitTitle(kind: LocationKind, unitLabel: string) {
  if (kind === "ivar") return `Ivar ${unitLabel}`;
  if (kind === "bench") return `Bänk ${unitLabel}`;
  return `Skåp ${unitLabel}`;
}

function getUnitSlug(kind: LocationKind, unitId: string) {
  if (kind === "ivar") {
    return unitId.toLowerCase();
  }

  return `${kind}-${unitId.toLowerCase()}`;
}

function parseUnitSlug(slug: string) {
  const trimmed = slug.trim().toLowerCase();
  if (/^[a-z]$/.test(trimmed)) {
    return { kind: "ivar" as const, unitId: trimmed.toUpperCase() };
  }

  const match = trimmed.match(/^(bench|cabinet)-([a-z0-9-]+)$/i);
  if (!match) {
    return null;
  }

  return {
    kind: match[1].toLowerCase() as LocationKind,
    unitId: match[2].toUpperCase()
  };
}

export function getShelfUnits(data: InventoryData): ShelfUnit[] {
  const sessionsByBox = getCurrentSessionByBox(data);
  const photosBySession = new Map<string, PhotoRecord[]>();

  for (const photo of data.photos) {
    const current = photosBySession.get(photo.sessionId) ?? [];
    current.push(photo);
    photosBySession.set(photo.sessionId, current);
  }

  const unitsByKey = new Map<string, ShelfBoxEntry[]>();

  for (const box of data.boxes) {
    const location = parseBoxLocation(box);
    if (!location) {
      continue;
    }

    const session = sessionsByBox.get(box.boxId);
    const photos = session ? photosBySession.get(session.sessionId) ?? [] : [];
    const key = `${location.kind}:${location.unitId}`;
    const entries = unitsByKey.get(key) ?? [];
    entries.push({
      box,
      session,
      photos,
      location
    });
    unitsByKey.set(key, entries);
  }

  return [...unitsByKey.entries()]
    .map(([key, boxes]): ShelfUnit => {
      const [kindToken, unitId] = key.split(":");
      const kind = kindToken as LocationKind;
      const firstLocation = boxes[0]?.location;
      const positionsMap = new Map<string, ShelfPosition>();

      for (const entry of boxes) {
        const positionKey = `${entry.location.rowId}:${entry.location.slot}`;
        const existing = positionsMap.get(positionKey);
        if (existing) {
          existing.boxes.push(entry);
        } else {
          positionsMap.set(positionKey, {
            rowId: entry.location.rowId,
            rowLabel: entry.location.rowLabel,
            rowSortKey: entry.location.rowSortKey,
            slot: entry.location.slot,
            slotSortKey: entry.location.slotSortKey,
            boxes: [entry]
          });
        }
      }

      const positions = [...positionsMap.values()]
        .map((position) => ({
          ...position,
          boxes: [...position.boxes].sort((a, b) => a.location.variant.localeCompare(b.location.variant))
        }))
        .sort((a, b) => (a.rowSortKey - b.rowSortKey) || (a.slotSortKey - b.slotSortKey));

      const rows = positions
        .map((position) => ({
          rowId: position.rowId,
          rowLabel: position.rowLabel,
          rowSortKey: position.rowSortKey
        }))
        .filter((row, index, allRows) => allRows.findIndex((candidate) => candidate.rowId === row.rowId) === index);

      const slots = [...new Set(positions.map((position) => position.slot))].sort((a, b) => Number(a) - Number(b));
      const unitLabel = firstLocation?.unitLabel ?? unitId;

      return {
        kind,
        unitId,
        unitLabel,
        slug: getUnitSlug(kind, unitId),
        title: getUnitTitle(kind, unitLabel),
        boxes: [...boxes].sort(
          (a, b) =>
            (a.location.rowSortKey - b.location.rowSortKey) ||
            (a.location.slotSortKey - b.location.slotSortKey) ||
            a.location.variant.localeCompare(b.location.variant)
        ),
        positions,
        rows,
        slots
      };
    })
    .sort((a, b) => {
      const left = a.boxes[0]?.location;
      const right = b.boxes[0]?.location;

      if (left && right) {
        return compareParsedLocations(left, right);
      }

      if (left) return -1;
      if (right) return 1;
      return a.title.localeCompare(b.title, "sv", { numeric: true, sensitivity: "base" });
    });
}

export function getShelfSystemCount(data: InventoryData) {
  return getShelfUnits(data).length;
}

export function getShelfUnitBySlug(data: InventoryData, slug: string) {
  const parsed = parseUnitSlug(slug);
  if (!parsed) {
    return null;
  }

  return getShelfUnits(data).find((unit) => unit.kind === parsed.kind && unit.unitId === parsed.unitId) ?? null;
}
