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
  /** Template for a shelf row, for example "Shelf {count}". */
  shelfRow?: string;
  benchTop?: string;
  benchUnder?: string;
};

function presentRow(location: NonNullable<ReturnType<typeof parseLocationId>>, labels?: LocationPresentationLabels) {
  if (location.kind === "bench") {
    if (location.rowId === "TOP" && labels?.benchTop) return labels.benchTop;
    if (location.rowId === "UNDER" && labels?.benchUnder) return labels.benchUnder;
    return location.rowLabel;
  }

  const shelfNumber = location.rowId.match(/^H(\d+)$/)?.[1];
  return shelfNumber && labels?.shelfRow ? labels.shelfRow.replace("{count}", shelfNumber) : location.rowLabel;
}

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

  const rowLabel = presentRow(location, labels);
  const shelfLabel = location.kind === "bench" ? `${labels?.surface ?? "Yta"}: ${rowLabel}` : rowLabel;

  return {
    system: systemLabel,
    shelf: shelfLabel,
    slot: `${labels?.slot ?? "Plats"}: ${location.slot}${location.variant}`
  };
}
