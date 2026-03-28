const fs = require("node:fs/promises");
const path = require("node:path");

const inventoryPath = path.join(process.cwd(), "data", "inventory.json");

function normalizeUnit(value) {
  return String(value)
    .trim()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toUpperCase();
}

function parseLocationId(locationId) {
  const trimmed = String(locationId ?? "").trim();

  const legacyIvar = trimmed.match(/^([A-Z])-H(\d+)-P(\d+)(?:-([A-Z]))?$/i);
  if (legacyIvar) {
    return {
      kind: "ivar",
      unitId: legacyIvar[1].toUpperCase(),
      rowId: `H${legacyIvar[2]}`,
      slot: legacyIvar[3],
      variant: legacyIvar[4]?.toUpperCase() ?? "",
      normalizedId: `${legacyIvar[1].toUpperCase()}-H${legacyIvar[2]}-P${legacyIvar[3]}${legacyIvar[4] ? `-${legacyIvar[4].toUpperCase()}` : ""}`
    };
  }

  const structuredBench = trimmed.match(/^BENCH:([A-Z0-9-]+):(TOP|UNDER):P(\d+)(?::([A-Z]))?$/i);
  if (structuredBench) {
    const unitId = normalizeUnit(structuredBench[1]);
    const rowId = structuredBench[2].toUpperCase();
    const slot = structuredBench[3];
    const variant = structuredBench[4]?.toUpperCase() ?? "";
    return {
      kind: "bench",
      unitId,
      rowId,
      slot,
      variant,
      normalizedId: `BENCH:${unitId}:${rowId}:P${slot}${variant ? `:${variant}` : ""}`
    };
  }

  const structuredCabinet = trimmed.match(/^CABINET:([A-Z0-9-]+):H(\d+):P(\d+)(?::([A-Z]))?$/i);
  if (structuredCabinet) {
    const unitId = normalizeUnit(structuredCabinet[1]);
    const rowId = `H${structuredCabinet[2]}`;
    const slot = structuredCabinet[3];
    const variant = structuredCabinet[4]?.toUpperCase() ?? "";
    return {
      kind: "cabinet",
      unitId,
      rowId,
      slot,
      variant,
      normalizedId: `CABINET:${unitId}:${rowId}:P${slot}${variant ? `:${variant}` : ""}`
    };
  }

  const structuredIvar = trimmed.match(/^IVAR:([A-Z0-9-]+):H(\d+):P(\d+)(?::([A-Z]))?$/i);
  if (structuredIvar) {
    const unitId = normalizeUnit(structuredIvar[1]);
    const rowId = `H${structuredIvar[2]}`;
    const slot = structuredIvar[3];
    const variant = structuredIvar[4]?.toUpperCase() ?? "";
    return {
      kind: "ivar",
      unitId,
      rowId,
      slot,
      variant,
      normalizedId: `${unitId}-H${structuredIvar[2]}-P${slot}${variant ? `-${variant}` : ""}`
    };
  }

  return null;
}

function parseBoxId(boxId) {
  const trimmed = String(boxId ?? "").trim();

  const ivar = trimmed.match(/^IVAR-([A-Z])-H(\d+)-P(\d+)-([A-Z])$/i);
  if (ivar) {
    return {
      kind: "ivar",
      unitId: ivar[1].toUpperCase(),
      rowId: `H${ivar[2]}`,
      slot: ivar[3],
      variant: ivar[4].toUpperCase(),
      normalizedId: `${ivar[1].toUpperCase()}-H${ivar[2]}-P${ivar[3]}-${ivar[4].toUpperCase()}`
    };
  }

  const bench = trimmed.match(/^BENCH-([A-Z0-9-]+)-(TOP|UNDER)-P(\d+)-([A-Z])$/i);
  if (bench) {
    const unitId = normalizeUnit(bench[1]);
    const rowId = bench[2].toUpperCase();
    const slot = bench[3];
    const variant = bench[4].toUpperCase();
    return {
      kind: "bench",
      unitId,
      rowId,
      slot,
      variant,
      normalizedId: `BENCH:${unitId}:${rowId}:P${slot}:${variant}`
    };
  }

  const cabinet = trimmed.match(/^CABINET-([A-Z0-9-]+)-H(\d+)-P(\d+)-([A-Z])$/i);
  if (cabinet) {
    const unitId = normalizeUnit(cabinet[1]);
    const rowId = `H${cabinet[2]}`;
    const slot = cabinet[3];
    const variant = cabinet[4].toUpperCase();
    return {
      kind: "cabinet",
      unitId,
      rowId,
      slot,
      variant,
      normalizedId: `CABINET:${unitId}:${rowId}:P${slot}:${variant}`
    };
  }

  return null;
}

function sameBase(left, right) {
  return (
    left &&
    right &&
    left.kind === right.kind &&
    left.unitId === right.unitId &&
    left.rowId === right.rowId &&
    left.slot === right.slot
  );
}

async function main() {
  const raw = await fs.readFile(inventoryPath, "utf8");
  const inventory = JSON.parse(raw);
  let updated = 0;
  let alreadyExact = 0;
  let skipped = 0;

  for (const box of inventory.boxes ?? []) {
    const exactFromBoxId = parseBoxId(box.boxId);
    const currentLocation = parseLocationId(box.currentLocationId);

    if (!exactFromBoxId || !currentLocation) {
      skipped += 1;
      continue;
    }

    if (!sameBase(exactFromBoxId, currentLocation)) {
      skipped += 1;
      continue;
    }

    if (currentLocation.variant) {
      alreadyExact += 1;
      continue;
    }

    box.currentLocationId = exactFromBoxId.normalizedId;
    updated += 1;
  }

  await fs.writeFile(inventoryPath, `${JSON.stringify(inventory, null, 2)}\n`, "utf8");

  console.log(`Updated ${updated} box currentLocationId values.`);
  console.log(`Already exact: ${alreadyExact}.`);
  console.log(`Skipped: ${skipped}.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
