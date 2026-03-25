import { parseBoxId, parseLocationId, type LocationKind, type ParsedLocation } from "@/lib/location-schema";
import type { BoxRecord } from "@/lib/types";

const LOCATION_KIND_ORDER: Record<LocationKind, number> = {
  ivar: 0,
  bench: 1,
  cabinet: 2
};

function compareText(left: string, right: string) {
  return left.localeCompare(right, "sv", { numeric: true, sensitivity: "base" });
}

function compareVariant(left: string, right: string) {
  if (!left && !right) return 0;
  if (!left) return -1;
  if (!right) return 1;
  return compareText(left, right);
}

export function compareParsedLocations(left: ParsedLocation, right: ParsedLocation) {
  return (
    (LOCATION_KIND_ORDER[left.kind] - LOCATION_KIND_ORDER[right.kind]) ||
    compareText(left.unitLabel, right.unitLabel) ||
    compareText(left.unitId, right.unitId) ||
    (left.rowSortKey - right.rowSortKey) ||
    compareText(left.rowId, right.rowId) ||
    (left.slotSortKey - right.slotSortKey) ||
    compareText(left.slot, right.slot) ||
    compareVariant(left.variant, right.variant)
  );
}

export function compareLocationStrings(left: string, right: string) {
  const parsedLeft = parseLocationId(left);
  const parsedRight = parseLocationId(right);

  if (parsedLeft && parsedRight) {
    return compareParsedLocations(parsedLeft, parsedRight);
  }

  if (parsedLeft) return -1;
  if (parsedRight) return 1;
  return compareText(left, right);
}

function parseBoxLocation(box: BoxRecord) {
  return parseLocationId(box.currentLocationId) ?? parseBoxId(box.boxId);
}

export function compareBoxesByLocation(left: BoxRecord, right: BoxRecord) {
  const parsedLeft = parseBoxLocation(left);
  const parsedRight = parseBoxLocation(right);

  if (parsedLeft && parsedRight) {
    return (
      compareParsedLocations(parsedLeft, parsedRight) ||
      compareText(left.label, right.label) ||
      compareText(left.boxId, right.boxId)
    );
  }

  if (parsedLeft) return -1;
  if (parsedRight) return 1;

  return (
    compareLocationStrings(left.currentLocationId, right.currentLocationId) ||
    compareText(left.label, right.label) ||
    compareText(left.boxId, right.boxId)
  );
}
