"use client";

import { useEffect, useMemo, useState } from "react";
import { ImageLightboxButton } from "@/app/components/image-lightbox-button";
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
  };
  initialPhotos: PhotoDraft[];
};

const roleOptions: PhotoRole[] = ["label", "location", "inside", "spread", "detail"];

function formatDateTime(value?: string) {
  if (!value) {
    return "Tid saknas";
  }

  return new Date(value).toLocaleString("sv-SE");
}

function formatLocationDisplay(locationId: string, boxId = "") {
  const location = presentLocation(locationId, boxId);
  return [location.system, location.shelf, location.slot].filter(Boolean).join(" ");
}

export function SessionForm({ defaults, initialPhotos }: SessionFormProps) {
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

  const photoRows = useMemo(
    () => photos.map((photo) => `${photo.immichAssetId}|${photo.photoRole}|${photo.capturedAt ?? ""}`).join("\n"),
    [photos]
  );
  const photoPayload = useMemo(
    () =>
      JSON.stringify(
        photos.map((photo) => ({
          photoId: photo.photoId,
          immichAssetId: photo.immichAssetId,
          photoRole: photo.photoRole,
          capturedAt: photo.capturedAt ?? "",
          notes: draftPhotoNotes[photo.immichAssetId] ?? ""
        }))
      ),
    [draftPhotoNotes, photos]
  );
  const presentedLocation = formatLocationDisplay(currentLocationId, boxId);

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

  async function analyzePhoto(assetId: string) {
    setAnalyzingPhotoId(assetId);
    setPhotoErrors((current) => ({ ...current, [assetId]: "" }));
    setPhotoStatuses((current) => ({ ...current, [assetId]: "Startar bildanalys..." }));
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
        throw new Error(startPayload.error ?? "Bildanalysen misslyckades.");
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
          throw new Error(statusPayload.error ?? "Bildanalysen misslyckades.");
        }

        setPhotoStatuses((current) => ({
          ...current,
          [assetId]: statusPayload.message ?? "Analyserar bild..."
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
          throw new Error(statusPayload.error ?? statusPayload.message ?? "Bildanalysen misslyckades.");
        }
      }
    } catch (error) {
      setPhotoErrors((current) => ({
        ...current,
        [assetId]: error instanceof Error ? error.message : "Bildanalysen misslyckades."
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
      <input type="hidden" name="currentLocationId" value={currentLocationId} />
      <input type="hidden" name="photoPayload" value={photoPayload} />
      <label>
        Etikett / lådnamn
        <input
          name="label"
          placeholder="Adaptrar"
          value={label}
          onChange={(event) => setLabel(event.target.value)}
          required
        />
      </label>
      <label>
        Aktuell plats
        <div className="card" style={{ padding: 12 }}>
          {presentedLocation ? (
            <div className="meta card-meta">
              {presentedLocation.split(" ").length > 0 ? (
                <>
                  <span>{presentLocation(currentLocationId, boxId).system}</span>
                  <span>{presentLocation(currentLocationId, boxId).shelf}</span>
                  <span>{presentLocation(currentLocationId, boxId).slot}</span>
                </>
              ) : null}
            </div>
          ) : (
            <span className="muted">Ingen plats vald ännu.</span>
          )}
        </div>
      </label>
      <input type="hidden" name="createdAt" value={defaults.createdAt} />
      <label>
        Sammanfattning
        <textarea
          name="summary"
          placeholder="Kort beskrivning av vad lådan innehåller just nu."
          value={summary}
          onChange={(event) => setSummary(event.target.value)}
          required
        />
      </label>
      <label>
        Sökord
        <textarea
          name="itemKeywords"
          placeholder="adaptrar, usb, ljud, rca, bnc"
          value={itemKeywords}
          onChange={(event) => setItemKeywords(event.target.value)}
        />
      </label>

      <input type="hidden" name="photoRows" value={photoRows} />

      <section className="panel" style={{ padding: 18 }}>
        <h3>Immich-bilder</h3>
        {photos.length > 0 ? (
          <div className="card-list">
            {photos.map((photo, index) => (
              <article className="card" key={photo.immichAssetId}>
                <div className="analysis-photo-row session-photo-row">
                  <ImageLightboxButton
                    alt={`Bild ${index + 1}`}
                    buttonClassName="analysis-image-button session-photo-button"
                    imageClassName="analysis-thumb session-photo-thumb"
                    thumbnailUrl={photo.thumbnailUrl}
                    originalUrl={photo.originalUrl}
                    overlayTitle={`Bild ${index + 1}`}
                    overlayMeta={formatDateTime(photo.capturedAt)}
                  />
                  <div className="shell session-photo-controls" style={{ gap: 12, minWidth: 0 }}>
                    <div className="meta">
                      <span>Bild {index + 1}</span>
                      <span>{formatDateTime(photo.capturedAt)}</span>
                    </div>
                    <label className="inline-field">
                      Roll
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
                        Flytta upp
                      </button>
                      <button type="button" className="button secondary" onClick={() => movePhoto(photo.immichAssetId, 1)}>
                        Flytta ner
                      </button>
                      <button type="button" className="button secondary" onClick={() => removePhoto(photo.immichAssetId)}>
                        Ta bort bild
                      </button>
                    </div>
                    <label className="inline-field">
                      Analystext
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
                        {photoElapsedSeconds[photo.immichAssetId] ? ` (${photoElapsedSeconds[photo.immichAssetId]} s)` : ""}
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
                        {analyzingPhotoId === photo.immichAssetId ? "Analyserar..." : "Analysera bild"}
                      </button>
                      <button
                        type="button"
                        className="button secondary"
                        onClick={() => resetPhotoNotes(photo.immichAssetId)}
                      >
                        Återställ
                      </button>
                      {(draftPhotoNotes[photo.immichAssetId] ?? "") ? (
                        <button
                          type="button"
                          className="button secondary"
                          onClick={() => clearPhotoAnalysis(photo.immichAssetId)}
                        >
                          Rensa analys
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="empty">Inga bilder valda ännu.</div>
        )}
      </section>

      <label>
        Noteringar
        <textarea
          name="notes"
          placeholder="Valfria noteringar om lådan eller inventeringen."
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
        />
      </label>
      <div>
        <button type="submit">Spara session</button>
      </div>
    </div>
  );
}
