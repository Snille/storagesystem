type PresentedLocation = {
  system: string;
  shelf: string;
  slot: string;
};

function parseLocationId(locationId: string) {
  const match = locationId.match(/^([A-Z])-H(\d+)-P(\d+)$/i);
  if (!match) {
    return null;
  }

  return {
    shelfSystem: match[1].toUpperCase(),
    shelf: match[2],
    slot: match[3]
  };
}

function parseBoxId(boxId: string) {
  const match = boxId.match(/^([A-Z]+)-([A-Z])-H(\d+)-P(\d+)-([A-Z])$/i);
  if (!match) {
    return null;
  }

  return {
    systemName: match[1],
    shelfSystem: match[2].toUpperCase(),
    shelf: match[3],
    slot: match[4],
    variant: match[5].toUpperCase()
  };
}

export function presentLocation(locationId: string, boxId?: string): PresentedLocation {
  const box = boxId ? parseBoxId(boxId) : null;
  const location = parseLocationId(locationId);

  const shelfSystem = box?.shelfSystem ?? location?.shelfSystem ?? "";
  const shelf = box?.shelf ?? location?.shelf ?? "";
  const slot = box?.slot ?? location?.slot ?? "";
  const variant = box?.variant ?? "";
  const systemName = box?.systemName ?? "IVAR";

  if (!shelfSystem || !shelf || !slot) {
    return {
      system: locationId || boxId || "",
      shelf: "",
      slot: ""
    };
  }

  return {
    system: `${systemName[0]}${systemName.slice(1).toLowerCase()}: ${shelfSystem}`,
    shelf: `Hylla: ${shelf}`,
    slot: `Plats: ${slot}${variant}`
  };
}
