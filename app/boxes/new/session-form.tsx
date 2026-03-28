"use client";

import { useEffect, useMemo, useState } from "react";
import { ImageLightboxButton } from "@/app/components/image-lightbox-button";
import { buildLocationId, parseBoxId, parseLocationId, type BenchZone, type LocationKind } from "@/lib/location-schema";
import { presentLocation } from "@/lib/location-presentation";
import { presentPhotoRole } from "@/lib/photo-role-presentation";
import type { PhotoRole } from "@/lib/types";

type PhotoDraft = {
  photoId?: string;
  immichAssetId: string;
  photoRole: PhotoRole;
  capturedAt?: string;
  notes?: string;
  thumbnailUrl: string;
  originalUrl: string;
};

type AvailablePhoto = {
  immichAssetId: string;
  capturedAt?: string;
  thumbnailUrl: string;
  originalUrl: string;
};

type SessionFormProps = {
  defaults: {
    boxId: string;
    label: string;
    currentLocationId: string;
    sessionId: string;
    createdAt: string;
    summary: string;
    itemKeywords: string;
    notes: string;
    duplicateWarning: string;
  };
  initialPhotos: PhotoDraft[];
  availablePhotos: AvailablePhoto[];
  existingBoxes: Array<{
    boxId: string;
    label: string;
    currentLocationId: string;
  }>;
  locale: string;
  ui: Record<string, string>;
};

function normalizeComparableText(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

const roleOptions: PhotoRole[] = ["label", "location", "inside", "spread", "detail"];

function formatDateTime(value: string | undefined, locale: string, missingTime: string) {
  if (!value) {
    return missingTime;
  }

  return new Date(value).toLocaleString(locale);
}

function formatLocationDisplay(locationId: string, boxId = "") {
  const location = presentLocation(locationId, boxId);
  return [location.system, location.shelf, location.slot].filter(Boolean).join(" ");
}

function resolveComparableLocationId(locationId: string, boxId = "") {
  const parsedLocation = parseLocationId(locationId);
  if (parsedLocation?.variant) {
    return parsedLocation.normalizedId;
  }

  const parsedBox = boxId ? parseBoxId(boxId) : null;
  if (parsedLocation && parsedBox) {
    const sameBase =
      parsedLocation.kind === parsedBox.kind &&
      parsedLocation.unitId === parsedBox.unitId &&
      parsedLocation.rowId === parsedBox.rowId &&
      parsedLocation.slot === parsedBox.slot;

    if (sameBase) {
      return parsedBox.normalizedId;
    }
  }

  return parsedLocation?.normalizedId ?? locationId.trim();
}

export function SessionForm({ defaults, initialPhotos, availablePhotos, existingBoxes, locale, ui }: SessionFormProps) {
  const t = (key: string, fallback: string, values?: Record<string, string | number>) => {
    const template = ui[key] ?? fallback;
    return template.replace(/\{(\w+)\}/g, (_, token: string) => String(values?.[token] ?? `{${token}}`));
  };
  const [photos, setPhotos] = useState<PhotoDraft[]>(initialPhotos);
  const [boxId, setBoxId] = useState(defaults.boxId);
  const [sessionId, setSessionId] = useState(defaults.sessionId);
  const [label, setLabel] = useState(defaults.label);
  const [currentLocationId, setCurrentLocationId] = useState(defaults.currentLocationId);
  const [summary, setSummary] = useState(defaults.summary);
  const [itemKeywords, setItemKeywords] = useState(defaults.itemKeywords);
  const [notes, setNotes] = useState(defaults.notes);
  const [photoNotes, setPhotoNotes] = useState<Record<string, string>>(
    Object.fromEntries(initialPhotos.map((photo) => [photo.immichAssetId, photo.notes ?? ""]))
  );
  const [draftPhotoNotes, setDraftPhotoNotes] = useState<Record<string, string>>(
    Object.fromEntries(initialPhotos.map((photo) => [photo.immichAssetId, photo.notes ?? ""]))
  );
  const [photoErrors, setPhotoErrors] = useState<Record<string, string>>({});
  const [photoStatuses, setPhotoStatuses] = useState<Record<string, string>>({});
  const [photoStatusStartedAt, setPhotoStatusStartedAt] = useState<Record<string, number>>({});
  const [photoElapsedSeconds, setPhotoElapsedSeconds] = useState<Record<string, number>>({});
  const [analyzingPhotoId, setAnalyzingPhotoId] = useState<string | null>(null);
  const [selectedAvailableIds, setSelectedAvailableIds] = useState<string[]>([]);
  const locationParts = parseLocationId(currentLocationId);
  const [locationKind, setLocationKind] = useState<LocationKind>(locationParts?.kind ?? "ivar");
  const [locationUnit, setLocationUnit] = useState(locationParts?.unitId ?? "");
  const [locationRow, setLocationRow] = useState(locationParts?.rowId ?? "");
  const [locationSlot, setLocationSlot] = useState(locationParts?.slot ?? "");
  const [locationVariant, setLocationVariant] = useState(locationParts?.variant ?? "");
  const isExistingBox = Boolean(defaults.boxId);
  const [isEditingLocation, setIsEditingLocation] = useState(!isExistingBox);

  useEffect(() => {
    const activeEntries = Object.entries(photoStatusStartedAt).filter(([, startedAt]) => Boolean(startedAt));
    if (activeEntries.length === 0) {
      setPhotoElapsedSeconds({});
      return;
    }

    const timer = window.setInterval(() => {
      setPhotoElapsedSeconds(
        Object.fromEntries(
          activeEntries.map(([assetId, startedAt]) => [
            assetId,
            Math.max(0, Math.floor((Date.now() - startedAt) / 1000))
          ])
        )
      );
    }, 500);

    return () => window.clearInterval(timer);
  }, [photoStatusStartedAt]);

  useEffect(() => {
    if (isExistingBox && !isEditingLocation) {
      return;
    }

    if (locationKind && locationUnit && locationRow && locationSlot) {
      setCurrentLocationId(
        buildLocationId({
          kind: locationKind,
          unitId: locationUnit,
          rowId: locationRow,
          slot: locationSlot,
          variant: locationVariant
        })
      );
    } else {
      setCurrentLocationId("");
    }
  }, [isExistingBox, isEditingLocation, locationKind, locationRow, locationSlot, locationUnit, locationVariant]);

  const availableAssets = availablePhotos.filter(
    (photo) =>
      !photos.some((selectedPhoto) => selectedPhoto.immichAssetId === photo.immichAssetId)
  );
  const pendingSelectedPhotos = useMemo(
    () =>
      availableAssets
        .filter((photo) => selectedAvailableIds.includes(photo.immichAssetId))
        .map<PhotoDraft>((photo) => ({
          photoId: undefined,
          immichAssetId: photo.immichAssetId,
          photoRole: "inside" as PhotoRole,
          capturedAt: photo.capturedAt,
          notes: "",
          thumbnailUrl: photo.thumbnailUrl,
          originalUrl: photo.originalUrl
        })),
    [availableAssets, selectedAvailableIds]
  );
  const effectivePhotos = useMemo(
    () => [...photos, ...pendingSelectedPhotos],
    [pendingSelectedPhotos, photos]
  );
  const photoRows = useMemo(
    () => effectivePhotos.map((photo) => `${photo.immichAssetId}|${photo.photoRole}|${photo.capturedAt ?? ""}`).join("\n"),
    [effectivePhotos]
  );
  const photoPayload = useMemo(
    () =>
      JSON.stringify(
        effectivePhotos.map((photo) => ({
          photoId: photo.photoId,
          immichAssetId: photo.immichAssetId,
          photoRole: photo.photoRole,
          capturedAt: photo.capturedAt ?? "",
          notes: draftPhotoNotes[photo.immichAssetId] ?? ""
        }))
      ),
    [draftPhotoNotes, effectivePhotos]
  );
  const presentedLocation = formatLocationDisplay(currentLocationId, boxId);
  const submittedLocationId =
    isExistingBox && !isEditingLocation ? resolveComparableLocationId(currentLocationId, boxId) : currentLocationId;
  const knownSystemsByKind = useMemo(() => {
    const ivarDefaults = ["A", "B", "C", "D", "E", "F", "G"];
    const grouped = new Map<LocationKind, string[]>();

    for (const kind of ["ivar", "bench", "cabinet"] as const) {
      grouped.set(kind, []);
    }

    for (const box of existingBoxes) {
      const parsed = parseLocationId(box.currentLocationId);
      if (!parsed) {
        continue;
      }

      const current = grouped.get(parsed.kind) ?? [];
      if (!current.includes(parsed.unitLabel)) {
        current.push(parsed.unitLabel);
      }
      grouped.set(parsed.kind, current);
    }

    const ivarKnown = Array.from(new Set([locationUnit, ...ivarDefaults, ...(grouped.get("ivar") ?? [])].filter(Boolean)));
    const benchKnown = Array.from(new Set([locationUnit, ...(grouped.get("bench") ?? [])].filter(Boolean)));
    const cabinetKnown = Array.from(new Set([locationUnit, ...(grouped.get("cabinet") ?? [])].filter(Boolean)));

    return {
      ivar: ivarKnown.sort((a, b) => a.localeCompare(b, "sv", { sensitivity: "base" })),
      bench: benchKnown.sort((a, b) => a.localeCompare(b, "sv", { sensitivity: "base" })),
      cabinet: cabinetKnown.sort((a, b) => a.localeCompare(b, "sv", { sensitivity: "base" }))
    };
  }, [existingBoxes, locationUnit]);
  const unitOptions = knownSystemsByKind[locationKind];
  const unitListId = `location-unit-options-${locationKind}`;
  const shelfOptions = Array.from({ length: 12 }, (_, index) => String(index + 1));
  const slotOptions = Array.from({ length: 12 }, (_, index) => String(index + 1));
  const variantOptions = Array.from({ length: 26 }, (_, index) => String.fromCharCode(65 + index));
  const benchZones: Array<{ value: BenchZone; label: string }> = [
    { value: "TOP", label: t("benchTop", "Ovanpå") },
    { value: "UNDER", label: t("benchUnder", "Under") }
  ];
  const exactLocationConflicts = useMemo(() => {
    if (!currentLocationId) {
      return [];
    }

    const normalizedLocation = resolveComparableLocationId(currentLocationId, boxId);

    return existingBoxes.filter((box) => {
      if (boxId && box.boxId === boxId) {
        return false;
      }

      const boxLocation = resolveComparableLocationId(box.currentLocationId, box.boxId);
      return boxLocation === normalizedLocation;
    });
  }, [boxId, currentLocationId, existingBoxes]);
  const duplicateBoxes = useMemo(() => {
    if (!currentLocationId || !label.trim()) {
      return [];
    }

    const normalizedLocation = resolveComparableLocationId(currentLocationId, boxId);
    const normalizedLabel = normalizeComparableText(label);

    return existingBoxes.filter((box) => {
      if (boxId && box.boxId === boxId) {
        return false;
      }

      const boxLocation = resolveComparableLocationId(box.currentLocationId, box.boxId);
      return (
        boxLocation === normalizedLocation &&
        normalizeComparableText(box.label) === normalizedLabel
      );
    });
  }, [boxId, currentLocationId, existingBoxes, label]);
  const hasDuplicateWarning = Boolean(defaults.duplicateWarning.trim());
  const locationLabels = {
    shelvingUnit: t("ivar", "Lagerhylla"),
    bench: t("bench", "Bänk"),
    cabinet: t("cabinet", "Skåp"),
    surface: t("surface", "Yta"),
    slot: t("place", "Plats")
  };

  function updateRole(immichAssetId: string, photoRole: PhotoRole) {
    setPhotos((current) =>
      current.map((photo) => (photo.immichAssetId === immichAssetId ? { ...photo, photoRole } : photo))
    );
  }

  function movePhoto(immichAssetId: string, direction: -1 | 1) {
    setPhotos((current) => {
      const index = current.findIndex((photo) => photo.immichAssetId === immichAssetId);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= current.length) {
        return current;
      }

      const draft = [...current];
      const [moved] = draft.splice(index, 1);
      draft.splice(nextIndex, 0, moved);
      return draft;
    });
  }

  function removePhoto(immichAssetId: string) {
    setPhotos((current) => current.filter((photo) => photo.immichAssetId !== immichAssetId));
    setPhotoNotes((current) => {
      const next = { ...current };
      delete next[immichAssetId];
      return next;
    });
    setDraftPhotoNotes((current) => {
      const next = { ...current };
      delete next[immichAssetId];
      return next;
    });
    setPhotoErrors((current) => {
      const next = { ...current };
      delete next[immichAssetId];
      return next;
    });
  }

  function toggleAvailablePhoto(immichAssetId: string) {
    setSelectedAvailableIds((current) =>
      current.includes(immichAssetId)
        ? current.filter((entry) => entry !== immichAssetId)
        : [...current, immichAssetId]
    );
  }

  function addSelectedPhotos() {
    if (selectedAvailableIds.length === 0) {
      return;
    }

    const toAdd = availableAssets.filter((photo) => selectedAvailableIds.includes(photo.immichAssetId));
    if (toAdd.length === 0) {
      return;
    }

    setPhotos((current) => [
      ...current,
      ...toAdd.map((photo) => ({
        immichAssetId: photo.immichAssetId,
        photoRole: "inside" as PhotoRole,
        capturedAt: photo.capturedAt,
        notes: "",
        thumbnailUrl: photo.thumbnailUrl,
        originalUrl: photo.originalUrl
      }))
    ]);
    setSelectedAvailableIds([]);
  }

  async function analyzePhoto(assetId: string) {
    setAnalyzingPhotoId(assetId);
    setPhotoErrors((current) => ({ ...current, [assetId]: "" }));
    setPhotoStatuses((current) => ({ ...current, [assetId]: t("startPhotoAnalysis", "Startar bildanalys...") }));
    setPhotoStatusStartedAt((current) => ({ ...current, [assetId]: Date.now() }));

    try {
      const startResponse = await fetch("/api/analyze-photo", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ assetId })
      });

      const startPayload = (await startResponse.json()) as { jobId?: string; error?: string };
      if (!startResponse.ok || startPayload.error || !startPayload.jobId) {
        throw new Error(startPayload.error ?? t("photoAnalysisFailed", "Bildanalysen misslyckades."));
      }

      while (true) {
        await new Promise((resolve) => setTimeout(resolve, 900));
        const statusResponse = await fetch(`/api/analyze-photo?jobId=${encodeURIComponent(startPayload.jobId)}`, {
          cache: "no-store"
        });
        const statusPayload = (await statusResponse.json()) as {
          phase?: "queued" | "running" | "completed" | "failed";
          message?: string;
          error?: string;
          result?: { summary?: string };
        };

        if (!statusResponse.ok) {
          throw new Error(statusPayload.error ?? t("photoAnalysisFailed", "Bildanalysen misslyckades."));
        }

        setPhotoStatuses((current) => ({
          ...current,
          [assetId]: statusPayload.message ?? t("analyzingPhoto", "Analyserar bild...")
        }));

        if (statusPayload.phase === "completed") {
          const summary = statusPayload.result?.summary ?? "";
          setPhotoNotes((current) => ({
            ...current,
            [assetId]: summary
          }));
          setDraftPhotoNotes((current) => ({
            ...current,
            [assetId]: summary
          }));
          break;
        }

        if (statusPayload.phase === "failed") {
          throw new Error(statusPayload.error ?? statusPayload.message ?? t("photoAnalysisFailed", "Bildanalysen misslyckades."));
        }
      }
    } catch (error) {
      setPhotoErrors((current) => ({
        ...current,
        [assetId]: error instanceof Error ? error.message : t("photoAnalysisFailed", "Bildanalysen misslyckades.")
      }));
    } finally {
      setAnalyzingPhotoId(null);
      setPhotoStatuses((current) => ({ ...current, [assetId]: "" }));
      setPhotoStatusStartedAt((current) => {
        const next = { ...current };
        delete next[assetId];
        return next;
      });
    }
  }

  function resetPhotoNotes(assetId: string) {
    setDraftPhotoNotes((current) => ({
      ...current,
      [assetId]: photoNotes[assetId] ?? ""
    }));
  }

  function clearPhotoAnalysis(assetId: string) {
    setPhotoNotes((current) => ({
      ...current,
      [assetId]: ""
    }));
    setDraftPhotoNotes((current) => ({
      ...current,
      [assetId]: ""
    }));
    setPhotoErrors((current) => ({ ...current, [assetId]: "" }));
  }

  return (
    <div className="form-grid">
      <input type="hidden" name="boxId" value={boxId} />
      <input type="hidden" name="sessionId" value={sessionId} />
      <input type="hidden" name="currentLocationId" value={submittedLocationId} />
      <input type="hidden" name="photoPayload" value={photoPayload} />
      <label>
        {t("locationLabel", "Aktuell plats")}
        {isExistingBox && !isEditingLocation ? (
          <>
            <div className="card" style={{ padding: 12 }}>
              {presentedLocation ? (
                <div className="meta card-meta">
                  <>
                    <span>{presentLocation(currentLocationId, boxId, locationLabels).system}</span>
                    <span>{presentLocation(currentLocationId, boxId, locationLabels).shelf}</span>
                    <span>{presentLocation(currentLocationId, boxId, locationLabels).slot}</span>
                  </>
                </div>
              ) : (
                <span className="muted">{t("noLocationSelected", "Ingen plats vald ännu.")}</span>
              )}
            </div>
            <div className="action-row" style={{ marginTop: 10 }}>
              <button type="button" className="button secondary" onClick={() => setIsEditingLocation(true)}>
                {t("changeLocation", "Ändra plats")}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="grid three">
              <label>
                {t("locationCategory", "Platskategori")}
                <select
                  value={locationKind}
                  onChange={(event) => {
                    const nextKind = event.target.value as LocationKind;
                    setLocationKind(nextKind);
                    setLocationRow(nextKind === "bench" ? "TOP" : "");
                  }}
                  required
                >
                  <option value="ivar">{t("ivar", "Lagerhylla")}</option>
                  <option value="bench">{t("bench", "Bänk")}</option>
                  <option value="cabinet">{t("cabinet", "Skåp")}</option>
                </select>
              </label>
              <label>
                {locationKind === "ivar" ? t("ivar", "Lagerhylla") : locationKind === "bench" ? t("bench", "Bänk") : t("cabinet", "Skåp")}
                <input
                  list={unitListId}
                  value={locationUnit}
                  onChange={(event) => setLocationUnit(event.target.value)}
                  placeholder={
                    locationKind === "ivar"
                      ? t("selectIvar", "Välj lagerhylla")
                      : locationKind === "bench"
                        ? "Svarv"
                        : "3D-print"
                  }
                  required
                />
                <datalist id={unitListId}>
                  {unitOptions.map((system) => (
                    <option key={system} value={system} />
                  ))}
                </datalist>
              </label>
              <label>
                {locationKind === "bench" ? t("surface", "Yta") : t("shelf", "Hylla")}
                {locationKind === "bench" ? (
                  <select value={locationRow} onChange={(event) => setLocationRow(event.target.value)} required>
                    {benchZones.map((zone) => (
                      <option key={zone.value} value={zone.value}>
                        {zone.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <select
                    value={locationRow.replace(/^H/i, "")}
                    onChange={(event) => setLocationRow(`H${event.target.value}`)}
                    required
                  >
                    <option value="">{t("selectShelf", "Välj hylla")}</option>
                    {shelfOptions.map((shelf) => (
                      <option key={shelf} value={shelf}>
                        {shelf}
                      </option>
                    ))}
                  </select>
                )}
              </label>
            </div>
            <div className="grid three" style={{ marginTop: 10 }}>
              <label>
                {t("place", "Plats")}
                <select value={locationSlot} onChange={(event) => setLocationSlot(event.target.value)} required>
                  <option value="">{t("selectSlot", "Välj plats")}</option>
                  {slotOptions.map((slot) => (
                    <option key={slot} value={slot}>
                      {slot}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {t("letter", "Bokstav")}
                <select value={locationVariant} onChange={(event) => setLocationVariant(event.target.value)}>
                  <option value="">{t("noLetter", "Ingen")}</option>
                  {variantOptions.map((variant) => (
                    <option key={variant} value={variant}>
                      {variant}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </>
        )}
        {isExistingBox && isEditingLocation ? (
          <div className="action-row" style={{ marginTop: 10 }}>
            <button type="button" className="button secondary" onClick={() => setIsEditingLocation(false)}>
              {t("doneWithLocation", "Klar med plats")}
            </button>
            <button
              type="button"
              className="button secondary"
              onClick={() => {
                const original = parseLocationId(defaults.currentLocationId);
                setLocationKind(original?.kind ?? "ivar");
                setLocationUnit(original?.unitId ?? "");
                setLocationRow(original?.rowId ?? "");
                setLocationSlot(original?.slot ?? "");
                setLocationVariant(original?.variant ?? "");
                setCurrentLocationId(defaults.currentLocationId);
                setIsEditingLocation(false);
              }}
            >
              {t("cancel", "Avbryt")}
            </button>
          </div>
        ) : null}
        {exactLocationConflicts.length > 0 ? (
          <div className="callout" style={{ marginTop: 10 }}>
            {exactLocationConflicts.length === 1
              ? t("exactConflictOne", "Varning: platsen används redan av {label} ({boxId}). Om du sparar som ny låda måste du välja en annan bokstav eller en annan plats.", {
                  label: exactLocationConflicts[0].label,
                  boxId: exactLocationConflicts[0].boxId
                })
              : t("exactConflictMany", "Varning: platsen används redan av {count} lådor. Om du sparar som ny låda måste du välja en annan bokstav eller en annan plats.", {
                  count: exactLocationConflicts.length
                })}
          </div>
        ) : null}
      </label>
      <label>
        {t("labelName", "Etikett / lådnamn")}
        <input
          name="label"
          placeholder={t("labelPlaceholder", "Adaptrar")}
          value={label}
          onChange={(event) => setLabel(event.target.value)}
          required
        />
      </label>
      <input type="hidden" name="createdAt" value={defaults.createdAt} />
      <label>
        {t("summary", "Sammanfattning")}
        <textarea
          name="summary"
          placeholder={t("summaryPlaceholder", "Kort beskrivning av vad lådan innehåller just nu.")}
          value={summary}
          onChange={(event) => setSummary(event.target.value)}
          required
        />
      </label>
      <label>
        {t("keywords", "Sökord")}
        <textarea
          name="itemKeywords"
          placeholder={t("keywordsPlaceholder", "adaptrar, usb, ljud, rca, bnc")}
          value={itemKeywords}
          onChange={(event) => setItemKeywords(event.target.value)}
        />
      </label>
      <label>
        {t("notes", "Noteringar")}
        <textarea
          name="notes"
          placeholder={t("notesPlaceholder", "Valfria noteringar om lådan eller inventeringen.")}
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
        />
      </label>
      {duplicateBoxes.length > 0 || hasDuplicateWarning ? (
        <div className="callout">
          {defaults.duplicateWarning ||
            (duplicateBoxes.length === 1
              ? t("duplicateOne", "Det finns redan en låda med samma namn på den här platsen. Välj en annan bokstav eller redigera den befintliga lådan istället.")
              : t("duplicateMany", "Det finns redan lådor med samma namn på den här platsen. Välj en annan bokstav eller redigera den befintliga lådan istället."))}
        </div>
      ) : null}
      <div>
        <button type="submit">{t("saveSession", "Spara session")}</button>
      </div>

      <input type="hidden" name="photoRows" value={photoRows} />

      <section className="panel" style={{ padding: 18 }}>
        <h3>{t("imagesTitle", "Immich-bilder")}</h3>
        {photos.length > 0 ? (
          <div className="card-list">
            {photos.map((photo, index) => (
              <article className="card" key={photo.immichAssetId}>
                <div className="analysis-photo-row session-photo-row">
                  <ImageLightboxButton
                    alt={t("imageNumber", "Bild {count}", { count: index + 1 })}
                    buttonClassName="analysis-image-button session-photo-button"
                    imageClassName="analysis-thumb session-photo-thumb"
                    thumbnailUrl={photo.thumbnailUrl}
                    originalUrl={photo.originalUrl}
                    overlayTitle={t("imageNumber", "Bild {count}", { count: index + 1 })}
                    overlayMeta={formatDateTime(photo.capturedAt, locale, t("missingTime", "Tid saknas"))}
                    overlayNote={draftPhotoNotes[photo.immichAssetId] ?? ""}
                  />
                  <div className="shell session-photo-controls" style={{ gap: 12, minWidth: 0 }}>
                    <div className="meta">
                      <span>{t("imageNumber", "Bild {count}", { count: index + 1 })}</span>
                      <span>{formatDateTime(photo.capturedAt, locale, t("missingTime", "Tid saknas"))}</span>
                    </div>
                    <label className="inline-field">
                      {t("role", "Roll")}
                      <select
                        value={photo.photoRole}
                        onChange={(event) => updateRole(photo.immichAssetId, event.target.value as PhotoRole)}
                      >
                        {roleOptions.map((role) => (
                          <option key={role} value={role}>
                            {presentPhotoRole(role)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className="action-row">
                      <button type="button" className="button secondary" onClick={() => movePhoto(photo.immichAssetId, -1)}>
                        {t("moveUp", "Flytta upp")}
                      </button>
                      <button type="button" className="button secondary" onClick={() => movePhoto(photo.immichAssetId, 1)}>
                        {t("moveDown", "Flytta ner")}
                      </button>
                      <button type="button" className="button secondary" onClick={() => removePhoto(photo.immichAssetId)}>
                        {t("removeImage", "Ta bort bild")}
                      </button>
                    </div>
                    <label className="inline-field">
                      {t("analysisText", "Analystext")}
                      <textarea
                        value={draftPhotoNotes[photo.immichAssetId] ?? ""}
                        onChange={(event) =>
                          setDraftPhotoNotes((current) => ({
                            ...current,
                            [photo.immichAssetId]: event.target.value
                          }))
                        }
                      />
                    </label>
                    {photoStatuses[photo.immichAssetId] ? (
                      <p className="muted">
                        {photoStatuses[photo.immichAssetId]}
                        {photoElapsedSeconds[photo.immichAssetId] ? ` ${t("secondsElapsed", "({seconds} s)", { seconds: photoElapsedSeconds[photo.immichAssetId] })}` : ""}
                      </p>
                    ) : null}
                    {photoErrors[photo.immichAssetId] ? (
                      <p className="callout">{photoErrors[photo.immichAssetId]}</p>
                    ) : null}
                    <div className="action-row">
                      <button
                        type="button"
                        className="button secondary"
                        onClick={() => analyzePhoto(photo.immichAssetId)}
                        disabled={analyzingPhotoId === photo.immichAssetId}
                      >
                        {analyzingPhotoId === photo.immichAssetId ? t("analyzingImage", "Analyserar...") : t("analyzeImage", "Analysera bild")}
                      </button>
                      <button
                        type="button"
                        className="button secondary"
                        onClick={() => resetPhotoNotes(photo.immichAssetId)}
                      >
                        {t("reset", "Återställ")}
                      </button>
                      {(draftPhotoNotes[photo.immichAssetId] ?? "") ? (
                        <button
                          type="button"
                          className="button secondary"
                          onClick={() => clearPhotoAnalysis(photo.immichAssetId)}
                        >
                          {t("clearAnalysis", "Rensa analys")}
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="empty">{t("noImagesSelected", "Inga bilder valda ännu.")}</div>
        )}

        <div className="section-header" style={{ marginTop: 18 }}>
          <h3>{t("selectImagesFromAlbum", "Välj bilder från albumet")}</h3>
          <div className="action-row">
            <span className="muted">{t("selectedCount", "{count} valda bilder", { count: selectedAvailableIds.length })}</span>
            <button
              type="button"
              className="button"
              onClick={addSelectedPhotos}
              disabled={selectedAvailableIds.length === 0}
            >
              {t("addSelectedImages", "Lägg till valda bilder")}
            </button>
          </div>
        </div>
        {availableAssets.length > 0 ? (
          <div className="photo-grid">
            {availableAssets.map((photo) => {
              const selected = selectedAvailableIds.includes(photo.immichAssetId);
              return (
                <article className={`photo-card selectable-photo${selected ? " selected" : ""}`} key={photo.immichAssetId}>
                  <button
                    type="button"
                    className={`button secondary select-toggle${selected ? " selected" : ""}`}
                    onClick={() => toggleAvailablePhoto(photo.immichAssetId)}
                  >
                    {selected ? t("selected", "Vald") : t("select", "Välj")}
                  </button>
                  <ImageLightboxButton
                    alt={t("availableAlbumImage", "Tillgänglig album-bild")}
                    buttonClassName="photo-open"
                    thumbnailUrl={photo.thumbnailUrl}
                    originalUrl={photo.originalUrl}
                    overlayTitle={t("albumImage", "Album-bild")}
                    overlayMeta={formatDateTime(photo.capturedAt, locale, t("missingTime", "Tid saknas"))}
                  />
                  <div className="body">
                    <p className="muted">{formatDateTime(photo.capturedAt, locale, t("missingTime", "Tid saknas"))}</p>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="empty">{t("noAvailableImages", "Det finns inga lediga bilder kvar att välja just nu.")}</div>
        )}
        {selectedAvailableIds.length > 0 ? (
          <p className="muted" style={{ marginTop: 12 }}>
            {t("markedImagesFollow", "Markerade album-bilder följer med när du sparar sessionen, även om du inte först klickar på `Lägg till valda bilder`.")}
          </p>
        ) : null}
      </section>
    </div>
  );
}
