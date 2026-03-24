export type LocationKind = "ivar" | "bench" | "cabinet";
export type BenchZone = "TOP" | "UNDER";

export type ParsedLocation = {
  kind: LocationKind;
  unitId: string;
  unitLabel: string;
  rowId: string;
  rowLabel: string;
  rowSortKey: number;
  slot: string;
  slotSortKey: number;
  variant: string;
  normalizedId: string;
};

function titleCase(value: string) {
  return value
    .toLowerCase()
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function normalizeLocationUnit(value: string) {
  return value
    .trim()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toUpperCase();
}

export function buildLocationId(input: {
  kind: LocationKind;
  unitId: string;
  rowId: string;
  slot: string;
  variant?: string;
}) {
  const unitId = normalizeLocationUnit(input.unitId);
  const slot = String(input.slot).trim();
  const variant = input.variant?.trim().toUpperCase() ?? "";

  if (input.kind === "ivar") {
    return `${unitId}-H${input.rowId.replace(/^H/i, "")}-P${slot}${variant ? `-${variant}` : ""}`;
  }

  const kindToken = input.kind === "bench" ? "BENCH" : "CABINET";
  return `${kindToken}:${unitId}:${input.rowId.toUpperCase()}:P${slot}${variant ? `:${variant}` : ""}`;
}

function parseLegacyIvarLocation(locationId: string) {
  const match = locationId.match(/^([A-Z])-H(\d+)-P(\d+)(?:-([A-Z]))?$/i);
  if (!match) {
    return null;
  }

  const unitId = match[1].toUpperCase();
  const shelf = Number(match[2]);
  const slot = match[3];
  const variant = match[4]?.toUpperCase() ?? "";

  if (!Number.isFinite(shelf) || shelf <= 0) {
    return null;
  }

  return {
    kind: "ivar" as const,
    unitId,
    unitLabel: unitId,
    rowId: `H${shelf}`,
    rowLabel: `Hylla ${shelf}`,
    rowSortKey: shelf,
    slot,
    slotSortKey: Number(slot),
    variant,
    normalizedId: buildLocationId({
      kind: "ivar",
      unitId,
      rowId: `H${shelf}`,
      slot,
      variant
    })
  } satisfies ParsedLocation;
}

function parseStructuredLocation(locationId: string) {
  const benchMatch = locationId.match(/^BENCH:([A-Z0-9-]+):(TOP|UNDER):P(\d+)(?::([A-Z]))?$/i);
  if (benchMatch) {
    const unitId = normalizeLocationUnit(benchMatch[1]);
    const zone = benchMatch[2].toUpperCase() as BenchZone;
    const slot = benchMatch[3];
    const variant = benchMatch[4]?.toUpperCase() ?? "";

    return {
      kind: "bench" as const,
      unitId,
      unitLabel: titleCase(unitId),
      rowId: zone,
      rowLabel: zone === "TOP" ? "Ovanpå" : "Under",
      rowSortKey: zone === "TOP" ? 1 : 2,
      slot,
      slotSortKey: Number(slot),
      variant,
      normalizedId: buildLocationId({
        kind: "bench",
        unitId,
        rowId: zone,
        slot,
        variant
      })
    } satisfies ParsedLocation;
  }

  const cabinetMatch = locationId.match(/^CABINET:([A-Z0-9-]+):H(\d+):P(\d+)(?::([A-Z]))?$/i);
  if (cabinetMatch) {
    const unitId = normalizeLocationUnit(cabinetMatch[1]);
    const shelf = Number(cabinetMatch[2]);
    const slot = cabinetMatch[3];
    const variant = cabinetMatch[4]?.toUpperCase() ?? "";

    return {
      kind: "cabinet" as const,
      unitId,
      unitLabel: titleCase(unitId),
      rowId: `H${shelf}`,
      rowLabel: `Hylla ${shelf}`,
      rowSortKey: shelf,
      slot,
      slotSortKey: Number(slot),
      variant,
      normalizedId: buildLocationId({
        kind: "cabinet",
        unitId,
        rowId: `H${shelf}`,
        slot,
        variant
      })
    } satisfies ParsedLocation;
  }

  const ivarMatch = locationId.match(/^IVAR:([A-Z0-9-]+):H(\d+):P(\d+)(?::([A-Z]))?$/i);
  if (ivarMatch) {
    const unitId = normalizeLocationUnit(ivarMatch[1]);
    const shelf = Number(ivarMatch[2]);
    const slot = ivarMatch[3];
    const variant = ivarMatch[4]?.toUpperCase() ?? "";

    return {
      kind: "ivar" as const,
      unitId,
      unitLabel: unitId,
      rowId: `H${shelf}`,
      rowLabel: `Hylla ${shelf}`,
      rowSortKey: shelf,
      slot,
      slotSortKey: Number(slot),
      variant,
      normalizedId: buildLocationId({
        kind: "ivar",
        unitId,
        rowId: `H${shelf}`,
        slot,
        variant
      })
    } satisfies ParsedLocation;
  }

  return null;
}

export function parseLocationId(locationId: string) {
  const trimmed = locationId.trim();
  return parseStructuredLocation(trimmed) ?? parseLegacyIvarLocation(trimmed);
}

export function parseBoxId(boxId: string) {
  const ivarMatch = boxId.match(/^IVAR-([A-Z])-H(\d+)-P(\d+)-([A-Z])$/i);
  if (ivarMatch) {
    return parseLocationId(`IVAR:${ivarMatch[1].toUpperCase()}:H${ivarMatch[2]}:P${ivarMatch[3]}:${ivarMatch[4].toUpperCase()}`);
  }

  const benchMatch = boxId.match(/^BENCH-([A-Z0-9-]+)-(TOP|UNDER)-P(\d+)-([A-Z])$/i);
  if (benchMatch) {
    return parseLocationId(
      `BENCH:${normalizeLocationUnit(benchMatch[1])}:${benchMatch[2].toUpperCase()}:P${benchMatch[3]}:${benchMatch[4].toUpperCase()}`
    );
  }

  const cabinetMatch = boxId.match(/^CABINET-([A-Z0-9-]+)-H(\d+)-P(\d+)-([A-Z])$/i);
  if (cabinetMatch) {
    return parseLocationId(
      `CABINET:${normalizeLocationUnit(cabinetMatch[1])}:H${cabinetMatch[2]}:P${cabinetMatch[3]}:${cabinetMatch[4].toUpperCase()}`
    );
  }

  return null;
}
