import { presentLocation } from "@/lib/location-presentation";

export function buildLabelDescription(boxNotes?: string, sessionSummary?: string) {
  if (boxNotes?.trim()) {
    return boxNotes.trim();
  }

  if (sessionSummary?.trim()) {
    return sessionSummary.trim();
  }

  return "";
}

export function buildLabelPlaceText(locationId: string, boxId?: string) {
  const location = presentLocation(locationId, boxId);
  return [location.system, location.shelf, location.slot].filter(Boolean).join(", ");
}
