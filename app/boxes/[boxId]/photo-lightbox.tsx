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
  locale: string;
  ui: Record<string, string>;
};

function formatDateTime(value: string | undefined, locale: string, missingTime: string) {
  if (!value) {
    return missingTime;
  }

  return new Date(value).toLocaleString(locale);
}

export function PhotoLightbox({ boxLabel, photos, gridClassName, locale, ui }: PhotoLightboxProps) {
  const t = (key: string, fallback: string, values?: Record<string, string | number>) => {
    const template = ui[key] ?? fallback;
    return template.replace(/\{(\w+)\}/g, (_, token: string) => String(values?.[token] ?? `{${token}}`));
  };
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
    setPhotoStatuses((current) => ({ ...current, [photoId]: t("startPhotoAnalysis", "Startar bildanalys...") }));
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
          [photoId]: statusPayload.message ?? t("analyzingPhoto", "Analyserar bild...")
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
          throw new Error(statusPayload.error ?? statusPayload.message ?? t("photoAnalysisFailed", "Bildanalysen misslyckades."));
        }
      }

    } catch (error) {
      setPhotoErrors((current) => ({
        ...current,
        [photoId]: error instanceof Error ? error.message : t("photoAnalysisFailed", "Bildanalysen misslyckades.")
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
        throw new Error(payload.error ?? t("clearAnalysisFailed", "Kunde inte rensa bildanalysen."));
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
        throw new Error(payload.error ?? t("saveTextFailed", "Kunde inte spara analystexten."));
      }

      setPhotoNotes((current) => ({
        ...current,
        [photoId]: payload.notes ?? ""
      }));
    } catch (error) {
      setPhotoErrors((current) => ({
        ...current,
        [photoId]: error instanceof Error ? error.message : t("saveTextFailed", "Kunde inte spara analystexten.")
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
        throw new Error(payload.error ?? t("releaseImageFailed", "Kunde inte släppa bilden."));
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
              aria-label={`${t("closeImageView", "Visa större bild")}: ${boxLabel} ${presentPhotoRole(photo.photoRole)}`}
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
              <p className="muted" style={{ marginTop: 6 }}>{formatDateTime(photo.capturedAt, locale, t("missingTime", "Tid saknas"))}</p>
              <label className="inline-field">
                {t("analysisText", "Analystext")}
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
                  {photoElapsedSeconds[photo.photoId] ? ` ${t("secondsElapsed", "({seconds} s)", { seconds: photoElapsedSeconds[photo.photoId] })}` : ""}
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
                  {analyzingPhotoId === photo.photoId ? t("analyzingImage", "Analyserar...") : t("analyzeImage", "Analysera bild")}
                </button>
                <button
                  type="button"
                  className="button secondary"
                  onClick={() => savePhotoNotes(photo.photoId)}
                  disabled={savingPhotoId === photo.photoId}
                >
                  {savingPhotoId === photo.photoId ? t("saving", "Sparar...") : t("saveText", "Spara text")}
                </button>
                <button
                  type="button"
                  className="button secondary"
                  onClick={() => resetDraftNotes(photo.photoId)}
                  disabled={savingPhotoId === photo.photoId}
                  style={{ marginLeft: "auto" }}
                >
                  {t("reset", "Återställ")}
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
                    {t("clearAnalysis", "Rensa analys")}
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
                  {t("releaseImage", "Släpp bild")}
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
              aria-label={t("closeImageView", "Stäng bildvisning")}
            >
              X
            </button>
            <div className="lightbox-meta">
              <strong>{boxLabel}</strong>
              <span>{presentPhotoRole(activePhoto.photoRole)}</span>
              <span>{formatDateTime(activePhoto.capturedAt, locale, t("missingTime", "Tid saknas"))}</span>
            </div>
            <label className="inline-field">
              {t("analysisText", "Analystext")}
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
                {photoElapsedSeconds[activePhoto.photoId] ? ` ${t("secondsElapsed", "({seconds} s)", { seconds: photoElapsedSeconds[activePhoto.photoId] })}` : ""}
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
                {analyzingPhotoId === activePhoto.photoId ? t("analyzingImage", "Analyserar...") : t("analyzeImage", "Analysera bild")}
              </button>
              <button
                type="button"
                className="button secondary"
                onClick={() => savePhotoNotes(activePhoto.photoId)}
                disabled={savingPhotoId === activePhoto.photoId}
              >
                {savingPhotoId === activePhoto.photoId ? t("saving", "Sparar...") : t("saveText", "Spara text")}
              </button>
              <button
                type="button"
                className="button secondary"
                onClick={() => resetDraftNotes(activePhoto.photoId)}
                disabled={savingPhotoId === activePhoto.photoId}
                style={{ marginLeft: "auto" }}
              >
                {t("reset", "Återställ")}
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
                  {t("clearAnalysis", "Rensa analys")}
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
                {t("releaseImage", "Släpp bild")}
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
