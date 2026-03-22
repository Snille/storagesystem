"use client";

import { useEffect, useState } from "react";
import { presentPhotoRole } from "@/lib/photo-role-presentation";

type LightboxPhoto = {
  photoId: string;
  immichAssetId: string;
  photoRole: string;
  capturedAt?: string;
  notes?: string;
  thumbnailUrl: string;
  originalUrl: string;
};

type PhotoLightboxProps = {
  boxLabel: string;
  photos: LightboxPhoto[];
  gridClassName?: string;
};

function formatDateTime(value?: string) {
  if (!value) {
    return "Tid saknas";
  }

  return new Date(value).toLocaleString("sv-SE");
}

export function PhotoLightbox({ boxLabel, photos, gridClassName }: PhotoLightboxProps) {
  const [photoItems, setPhotoItems] = useState<LightboxPhoto[]>(photos);
  const [activePhotoId, setActivePhotoId] = useState<string | null>(null);
  const [photoNotes, setPhotoNotes] = useState<Record<string, string>>(
    Object.fromEntries(photos.map((photo) => [photo.photoId, photo.notes ?? ""]))
  );
  const [draftNotes, setDraftNotes] = useState<Record<string, string>>(
    Object.fromEntries(photos.map((photo) => [photo.photoId, photo.notes ?? ""]))
  );
  const [photoErrors, setPhotoErrors] = useState<Record<string, string>>({});
  const [photoStatuses, setPhotoStatuses] = useState<Record<string, string>>({});
  const [photoStatusStartedAt, setPhotoStatusStartedAt] = useState<Record<string, number>>({});
  const [photoElapsedSeconds, setPhotoElapsedSeconds] = useState<Record<string, number>>({});
  const [analyzingPhotoId, setAnalyzingPhotoId] = useState<string | null>(null);
  const [savingPhotoId, setSavingPhotoId] = useState<string | null>(null);
  const activePhoto = photoItems.find((photo) => photo.photoId === activePhotoId) ?? null;

  useEffect(() => {
    const activeEntries = Object.entries(photoStatusStartedAt).filter(([, startedAt]) => Boolean(startedAt));
    if (activeEntries.length === 0) {
      setPhotoElapsedSeconds({});
      return;
    }

    const timer = window.setInterval(() => {
      setPhotoElapsedSeconds(
        Object.fromEntries(
          activeEntries.map(([photoId, startedAt]) => [
            photoId,
            Math.max(0, Math.floor((Date.now() - startedAt) / 1000))
          ])
        )
      );
    }, 500);

    return () => window.clearInterval(timer);
  }, [photoStatusStartedAt]);

  useEffect(() => {
    if (!activePhoto) {
      return;
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setActivePhotoId(null);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activePhoto]);

  async function analyzePhoto(photoId: string, assetId: string) {
    setAnalyzingPhotoId(photoId);
    setPhotoErrors((current) => ({ ...current, [photoId]: "" }));
    setPhotoStatuses((current) => ({ ...current, [photoId]: "Startar bildanalys..." }));
    setPhotoStatusStartedAt((current) => ({ ...current, [photoId]: Date.now() }));

    try {
      const startResponse = await fetch("/api/analyze-photo", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ photoId, assetId })
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
          [photoId]: statusPayload.message ?? "Analyserar bild..."
        }));

        if (statusPayload.phase === "completed") {
          const summary = statusPayload.result?.summary ?? "";
          setPhotoNotes((current) => ({
            ...current,
            [photoId]: summary
          }));
          setDraftNotes((current) => ({
            ...current,
            [photoId]: summary
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
        [photoId]: error instanceof Error ? error.message : "Bildanalysen misslyckades."
      }));
    } finally {
      setAnalyzingPhotoId(null);
      setPhotoStatuses((current) => ({ ...current, [photoId]: "" }));
      setPhotoStatusStartedAt((current) => {
        const next = { ...current };
        delete next[photoId];
        return next;
      });
    }
  }

  async function clearPhotoAnalysis(photoId: string) {
    setAnalyzingPhotoId(photoId);

    try {
      const response = await fetch("/api/analyze-photo", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ photoId, clear: true })
      });

      const payload = (await response.json()) as { error?: string };
      if (!response.ok || payload.error) {
        throw new Error(payload.error ?? "Kunde inte rensa bildanalysen.");
      }

      setPhotoNotes((current) => ({
        ...current,
        [photoId]: ""
      }));
      setDraftNotes((current) => ({
        ...current,
        [photoId]: ""
      }));
      setPhotoErrors((current) => ({ ...current, [photoId]: "" }));
    } finally {
      setAnalyzingPhotoId(null);
    }
  }

  async function savePhotoNotes(photoId: string) {
    setSavingPhotoId(photoId);
    setPhotoErrors((current) => ({ ...current, [photoId]: "" }));

    try {
      const response = await fetch("/api/photo-notes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ photoId, notes: draftNotes[photoId] ?? "" })
      });

      const payload = (await response.json()) as { ok?: boolean; notes?: string; error?: string };
      if (!response.ok || payload.error || !payload.ok) {
        throw new Error(payload.error ?? "Kunde inte spara analystexten.");
      }

      setPhotoNotes((current) => ({
        ...current,
        [photoId]: payload.notes ?? ""
      }));
    } catch (error) {
      setPhotoErrors((current) => ({
        ...current,
        [photoId]: error instanceof Error ? error.message : "Kunde inte spara analystexten."
      }));
    } finally {
      setSavingPhotoId(null);
    }
  }

  function resetDraftNotes(photoId: string) {
    setDraftNotes((current) => ({
      ...current,
      [photoId]: photoNotes[photoId] ?? ""
    }));
  }

  async function releasePhoto(photoId: string) {
    setAnalyzingPhotoId(photoId);

    try {
      const response = await fetch("/api/release-photo", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ photoId })
      });

      const payload = (await response.json()) as { error?: string };
      if (!response.ok || payload.error) {
        throw new Error(payload.error ?? "Kunde inte släppa bilden.");
      }

      setPhotoItems((current) => current.filter((photo) => photo.photoId !== photoId));
      setPhotoNotes((current) => {
        const next = { ...current };
        delete next[photoId];
        return next;
      });
      setPhotoErrors((current) => {
        const next = { ...current };
        delete next[photoId];
        return next;
      });
      setDraftNotes((current) => {
        const next = { ...current };
        delete next[photoId];
        return next;
      });
      if (activePhotoId === photoId) {
        setActivePhotoId(null);
      }
    } finally {
      setAnalyzingPhotoId(null);
    }
  }

  return (
    <>
      <div className={`photo-grid${gridClassName ? ` ${gridClassName}` : ""}`}>
        {photoItems.map((photo) => (
          <article className="photo-card" key={photo.photoId}>
            <button
              type="button"
              className="photo-open"
              onClick={() => setActivePhotoId(photo.photoId)}
              aria-label={`Visa större bild för ${boxLabel} ${presentPhotoRole(photo.photoRole)}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                alt={`${boxLabel} ${presentPhotoRole(photo.photoRole)}`}
                src={photo.thumbnailUrl}
                loading="lazy"
                decoding="async"
              />
            </button>
            <div className="body">
              <strong>{presentPhotoRole(photo.photoRole)}</strong>
              <p className="muted" style={{ marginTop: 6 }}>{formatDateTime(photo.capturedAt)}</p>
              <label className="inline-field">
                Analystext
                <textarea
                  value={draftNotes[photo.photoId] ?? ""}
                  onChange={(event) =>
                    setDraftNotes((current) => ({
                      ...current,
                      [photo.photoId]: event.target.value
                    }))
                  }
                />
              </label>
              {photoStatuses[photo.photoId] ? (
                <p className="muted">
                  {photoStatuses[photo.photoId]}
                  {photoElapsedSeconds[photo.photoId] ? ` (${photoElapsedSeconds[photo.photoId]} s)` : ""}
                </p>
              ) : null}
              {photoErrors[photo.photoId] ? <p className="callout">{photoErrors[photo.photoId]}</p> : null}
              <div className="action-row" style={{ marginTop: 10 }}>
                <button
                  type="button"
                  className="button secondary"
                  onClick={() => analyzePhoto(photo.photoId, photo.immichAssetId)}
                  disabled={analyzingPhotoId === photo.photoId}
                >
                  {analyzingPhotoId === photo.photoId ? "Analyserar..." : "Analysera bild"}
                </button>
                <button
                  type="button"
                  className="button secondary"
                  onClick={() => savePhotoNotes(photo.photoId)}
                  disabled={savingPhotoId === photo.photoId}
                >
                  {savingPhotoId === photo.photoId ? "Sparar..." : "Spara text"}
                </button>
                <button
                  type="button"
                  className="button secondary"
                  onClick={() => resetDraftNotes(photo.photoId)}
                  disabled={savingPhotoId === photo.photoId}
                  style={{ marginLeft: "auto" }}
                >
                  Återställ
                </button>
              </div>
              {photoNotes[photo.photoId] ? (
                <p style={{ marginTop: 8 }}>
                  <button
                    type="button"
                    className="button secondary"
                    onClick={() => clearPhotoAnalysis(photo.photoId)}
                    disabled={analyzingPhotoId === photo.photoId}
                  >
                    Rensa analys
                  </button>
                </p>
              ) : null}
              <p style={{ marginTop: 8 }}>
                <button
                  type="button"
                  className="button secondary"
                  onClick={() => releasePhoto(photo.photoId)}
                  disabled={analyzingPhotoId === photo.photoId}
                >
                  Släpp bild
                </button>
              </p>
            </div>
          </article>
        ))}
      </div>

      {activePhoto ? (
        <div className="lightbox-overlay" role="dialog" aria-modal="true" onClick={() => setActivePhotoId(null)}>
          <div className="lightbox-panel" onClick={(event) => event.stopPropagation()}>
            <button
              type="button"
              className="lightbox-close"
              onClick={() => setActivePhotoId(null)}
              aria-label="Stäng bildvisning"
            >
              X
            </button>
            <div className="lightbox-meta">
              <strong>{boxLabel}</strong>
              <span>{presentPhotoRole(activePhoto.photoRole)}</span>
              <span>{formatDateTime(activePhoto.capturedAt)}</span>
            </div>
            <label className="inline-field">
              Analystext
              <textarea
                value={draftNotes[activePhoto.photoId] ?? ""}
                onChange={(event) =>
                  setDraftNotes((current) => ({
                    ...current,
                    [activePhoto.photoId]: event.target.value
                  }))
                }
              />
            </label>
            {photoStatuses[activePhoto.photoId] ? (
              <p className="muted">
                {photoStatuses[activePhoto.photoId]}
                {photoElapsedSeconds[activePhoto.photoId] ? ` (${photoElapsedSeconds[activePhoto.photoId]} s)` : ""}
              </p>
            ) : null}
            {photoErrors[activePhoto.photoId] ? <p className="callout">{photoErrors[activePhoto.photoId]}</p> : null}
            <div className="action-row" style={{ marginTop: 8 }}>
              <button
                type="button"
                className="button secondary"
                onClick={() => analyzePhoto(activePhoto.photoId, activePhoto.immichAssetId)}
                disabled={analyzingPhotoId === activePhoto.photoId}
              >
                {analyzingPhotoId === activePhoto.photoId ? "Analyserar..." : "Analysera bild"}
              </button>
              <button
                type="button"
                className="button secondary"
                onClick={() => savePhotoNotes(activePhoto.photoId)}
                disabled={savingPhotoId === activePhoto.photoId}
              >
                {savingPhotoId === activePhoto.photoId ? "Sparar..." : "Spara text"}
              </button>
              <button
                type="button"
                className="button secondary"
                onClick={() => resetDraftNotes(activePhoto.photoId)}
                disabled={savingPhotoId === activePhoto.photoId}
                style={{ marginLeft: "auto" }}
              >
                Återställ
              </button>
            </div>
            {photoNotes[activePhoto.photoId] ? (
              <p style={{ marginTop: 8, marginBottom: 0 }}>
                <button
                  type="button"
                  className="button secondary"
                  onClick={() => clearPhotoAnalysis(activePhoto.photoId)}
                  disabled={analyzingPhotoId === activePhoto.photoId}
                >
                  Rensa analys
                </button>
              </p>
            ) : null}
            <p style={{ marginTop: 8, marginBottom: 0 }}>
              <button
                type="button"
                className="button secondary"
                onClick={() => releasePhoto(activePhoto.photoId)}
                disabled={analyzingPhotoId === activePhoto.photoId}
              >
                Släpp bild
              </button>
            </p>
            <div className="lightbox-image-wrap">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                alt={`${boxLabel} ${presentPhotoRole(activePhoto.photoRole)}`}
                className="lightbox-image"
                src={activePhoto.originalUrl}
                decoding="async"
              />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
