import { parseBoxId, parseLocationId } from "@/lib/location-schema";

type PresentedLocation = {
  system: string;
  shelf: string;
  slot: string;
};

export function presentLocation(locationId: string, boxId?: string): PresentedLocation {
  const location = parseLocationId(locationId) ?? (boxId ? parseBoxId(boxId) : null);

  if (!location) {
    return {
      system: locationId || boxId || "",
      shelf: "",
      slot: ""
    };
  }

  const systemLabel =
    location.kind === "ivar"
      ? `Ivar: ${location.unitLabel}`
      : location.kind === "bench"
        ? `Bänk: ${location.unitLabel}`
        : `Skåp: ${location.unitLabel}`;

  const shelfLabel = location.kind === "bench" ? `Yta: ${location.rowLabel}` : location.rowLabel;

  return {
    system: systemLabel,
    shelf: shelfLabel,
    slot: `Plats: ${location.slot}${location.variant}`
  };
}
