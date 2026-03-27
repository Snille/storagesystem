import { parseBoxId, parseLocationId } from "@/lib/location-schema";

type PresentedLocation = {
  system: string;
  shelf: string;
  slot: string;
};

type LocationPresentationLabels = {
  shelvingUnit?: string;
  bench?: string;
  cabinet?: string;
  surface?: string;
  slot?: string;
};

export function presentLocation(locationId: string, boxId?: string, labels?: LocationPresentationLabels): PresentedLocation {
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
      ? `${labels?.shelvingUnit ?? "Ivar"}: ${location.unitLabel}`
      : location.kind === "bench"
        ? `${labels?.bench ?? "Bänk"}: ${location.unitLabel}`
        : `${labels?.cabinet ?? "Skåp"}: ${location.unitLabel}`;

  const shelfLabel = location.kind === "bench" ? `${labels?.surface ?? "Yta"}: ${location.rowLabel}` : location.rowLabel;

  return {
    system: systemLabel,
    shelf: shelfLabel,
    slot: `${labels?.slot ?? "Plats"}: ${location.slot}${location.variant}`
  };
}
