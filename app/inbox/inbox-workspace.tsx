"use client";

import { useEffect, useState } from "react";
import { presentLocation } from "@/lib/location-presentation";
import { presentPhotoRole } from "@/lib/photo-role-presentation";
import type { AnalysisSuggestion, ImmichAsset, PhotoRole } from "@/lib/types";

type ActiveLightboxPhoto = {
  id: string;
  alt: string;
  originalUrl: string;
  meta: string;
  title: string;
};

type InboxWorkspaceProps = {
  assets: ImmichAsset[];
  thumbnailUrls: Record<string, string>;
  originalUrls: Record<string, string>;
  locale: string;
  ui: Record<string, string>;
};

const INBOX_PAGE_SIZE = 48;

function formatDateTime(value: string | undefined, locale: string, missingTime: string) {
  if (!value) {
    return missingTime;
  }

  return new Date(value).toLocaleString(locale);
}

const roleOptions: PhotoRole[] = ["label", "location", "inside", "spread", "detail"];

function buildDraftHref(suggestion: AnalysisSuggestion) {
  const params = new URLSearchParams();
  params.set("sessionId", suggestion.sessionId);
  params.set("boxId", suggestion.suggestedBoxId);
  params.set("label", suggestion.suggestedLabel);
  params.set("currentLocationId", suggestion.suggestedLocationId);
  params.set("summary", suggestion.suggestedSummary);
  params.set("itemKeywords", suggestion.suggestedKeywords.join(", "));
  params.set("notes", suggestion.suggestedNotes ?? "");
  params.set(
    "photoRows",
    suggestion.suggestedPhotos
      .map((photo) => `${photo.immichAssetId}|${photo.photoRole}|${photo.capturedAt ?? ""}`)
      .join("\n")
  );
  return `/boxes/new?${params.toString()}`;
}

function buildCandidateDraftHref(
  suggestion: AnalysisSuggestion,
  candidate: AnalysisSuggestion["matchCandidates"][number]
) {
  const params = new URLSearchParams();
  params.set("sessionId", suggestion.sessionId);
  params.set("boxId", candidate.boxId);
  params.set("label", candidate.label);
  params.set("currentLocationId", candidate.currentLocationId);
  params.set("summary", suggestion.suggestedSummary || candidate.summary);
  params.set("itemKeywords", suggestion.suggestedKeywords.join(", "));
  params.set("notes", suggestion.suggestedNotes ?? "");
  params.set(
    "photoRows",
    suggestion.suggestedPhotos
      .map((photo) => `${photo.immichAssetId}|${photo.photoRole}|${photo.capturedAt ?? ""}`)
      .join("\n")
  );
  return `/boxes/new?${params.toString()}`;
}

function getPrimaryMatchCandidate(suggestion: AnalysisSuggestion) {
  const exactSuggestedCandidate = suggestion.matchCandidates.find(
    (candidate) => candidate.boxId === suggestion.suggestedBoxId
  );
  if (exactSuggestedCandidate) {
    return exactSuggestedCandidate;
  }

  const bestCandidate = suggestion.matchCandidates[0];
  if (!bestCandidate) {
    return null;
  }

  if (bestCandidate.score >= 70) {
    return bestCandidate;
  }

  const exactLocationMatch =
    suggestion.suggestedLocationId &&
    bestCandidate.currentLocationId.toLowerCase() === suggestion.suggestedLocationId.toLowerCase();

  if (bestCandidate.score >= 50 && exactLocationMatch) {
    return bestCandidate;
  }

  return null;
}

export function InboxWorkspace({
  assets,
  thumbnailUrls,
  originalUrls,
  locale,
  ui
}: InboxWorkspaceProps) {
  const t = (key: string, fallback: string, values?: Record<string, string | number>) => {
    const template = ui[key] ?? fallback;
    return template.replace(/\{(\w+)\}/g, (_, token: string) => String(values?.[token] ?? `{${token}}`));
  };
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisStatus, setAnalysisStatus] = useState<string>("");
  const [analysisStartedAt, setAnalysisStartedAt] = useState<number | null>(null);
  const [analysisElapsedSeconds, setAnalysisElapsedSeconds] = useState(0);
  const [analysisError, setAnalysisError] = useState<string>("");
  const [suggestion, setSuggestion] = useState<AnalysisSuggestion | null>(null);
  const [activePhoto, setActivePhoto] = useState<ActiveLightboxPhoto | null>(null);
  const [visibleCount, setVisibleCount] = useState(INBOX_PAGE_SIZE);
  function renderLocationMeta(locationId: string, boxId = "") {
    const meta = presentLocation(locationId, boxId, {
      shelvingUnit: t("shelvingUnit", "Lagerhylla"),
      bench: t("bench", "Bänk"),
      cabinet: t("cabinet", "Skåp"),
      surface: t("surface", "Yta"),
      slot: t("slot", "Plats")
    });
    return (
      <>
        <span>{meta.system}</span>
        {meta.shelf ? <span>{meta.shelf}</span> : null}
        {meta.slot ? <span>{meta.slot}</span> : null}
      </>
    );
  }
  const primaryMatch = suggestion ? getPrimaryMatchCandidate(suggestion) : null;
  const quickAttachHref =
    suggestion && primaryMatch
      ? buildCandidateDraftHref(suggestion, primaryMatch)
      : suggestion && suggestion.suggestedBoxId
        ? buildDraftHref(suggestion)
        : "";
  const reversedAssets = [...assets].reverse();
  const visibleAssets = reversedAssets.slice(0, visibleCount);

  useEffect(() => {
    setVisibleCount(INBOX_PAGE_SIZE);
  }, [assets.length]);

  useEffect(() => {
    if (!isAnalyzing || !analysisStartedAt) {
      setAnalysisElapsedSeconds(0);
      return;
    }

    const timer = window.setInterval(() => {
      setAnalysisElapsedSeconds(Math.max(0, Math.floor((Date.now() - analysisStartedAt) / 1000)));
    }, 500);

    return () => window.clearInterval(timer);
  }, [analysisStartedAt, isAnalyzing]);

  useEffect(() => {
    if (!activePhoto) {
      return;
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setActivePhoto(null);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activePhoto]);

  function openLightbox(photo: ActiveLightboxPhoto) {
    setActivePhoto(photo);
  }

  function updatePhotoRole(immichAssetId: string, photoRole: PhotoRole) {
    setSuggestion((current) =>
      current
        ? {
            ...current,
            suggestedPhotos: current.suggestedPhotos.map((photo) =>
              photo.immichAssetId === immichAssetId ? { ...photo, photoRole } : photo
            )
          }
        : current
    );
  }

  function movePhoto(immichAssetId: string, direction: -1 | 1) {
    setSuggestion((current) => {
      if (!current) return current;
      const index = current.suggestedPhotos.findIndex((photo) => photo.immichAssetId === immichAssetId);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= current.suggestedPhotos.length) {
        return current;
      }

      const suggestedPhotos = [...current.suggestedPhotos];
      const [moved] = suggestedPhotos.splice(index, 1);
      suggestedPhotos.splice(nextIndex, 0, moved);
      return { ...current, suggestedPhotos };
    });
  }

  function toggleAsset(assetId: string) {
    setSuggestion(null);
    setAnalysisError("");
    setSelectedIds((current) =>
      current.includes(assetId) ? current.filter((id) => id !== assetId) : [...current, assetId]
    );
  }

  async function runAnalysis() {
    if (selectedIds.length === 0) {
      setAnalysisError(t("selectImageFirst", "Välj minst en bild först."));
      return;
    }

    setIsAnalyzing(true);
    setAnalysisStartedAt(Date.now());
    setAnalysisStatus(t("startingAnalysis", "Startar analys..."));
    setAnalysisError("");
    setSuggestion(null);

    try {
      const startResponse = await fetch("/api/analyze-selection", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ assetIds: selectedIds })
      });

      const startPayload = (await startResponse.json()) as { jobId?: string; error?: string };
      if (!startResponse.ok || startPayload.error || !startPayload.jobId) {
        throw new Error(startPayload.error ?? t("analysisFailed", "Analysen misslyckades."));
      }

      const jobId = startPayload.jobId;

      while (true) {
        await new Promise((resolve) => setTimeout(resolve, 900));
        const statusResponse = await fetch(`/api/analyze-selection?jobId=${encodeURIComponent(jobId)}`, {
          cache: "no-store"
        });
        const statusPayload = (await statusResponse.json()) as
          | {
              phase?: "queued" | "running" | "completed" | "failed";
              message?: string;
              error?: string;
              result?: AnalysisSuggestion;
            }
          | { error?: string };

        if (!statusResponse.ok) {
          throw new Error("error" in statusPayload ? statusPayload.error : t("analysisFailed", "Analysen misslyckades."));
        }

        const currentMessage =
          "message" in statusPayload && typeof statusPayload.message === "string"
            ? statusPayload.message
            : t("analyzing", "Analyserar...");
        setAnalysisStatus(currentMessage);

        if ("phase" in statusPayload && statusPayload.phase === "completed" && statusPayload.result) {
          setSuggestion(statusPayload.result);
          break;
        }

        if ("phase" in statusPayload && statusPayload.phase === "failed") {
          throw new Error(statusPayload.error || statusPayload.message || t("analysisFailed", "Analysen misslyckades."));
        }
      }
    } catch (error) {
      setAnalysisError(error instanceof Error ? error.message : t("analysisFailed", "Analysen misslyckades."));
    } finally {
      setIsAnalyzing(false);
      setAnalysisStartedAt(null);
      setAnalysisStatus("");
    }
  }

  return (
    <div className="shell">
      <section className="hero">
        <h1>{t("title", "Bilder att koppla")}</h1>
        <p>{t("intro", "Här visas bara nya bilder som ännu inte är kopplade till någon låda. Markera de bilder som hör till samma låda och låt appen föreslå en inventeringssession.")}</p>
        <div className="action-row">
          <button type="button" onClick={runAnalysis} disabled={isAnalyzing}>
            {isAnalyzing ? t("analyzingButton", "Analyserar...") : t("analyzeSelection", "Analysera markerade bilder")}
          </button>
          <span className="muted">{t("selectedCount", "{count} valda bilder", { count: selectedIds.length })}</span>
        </div>
        {isAnalyzing && analysisStatus ? (
          <div className="callout">
            <strong>{analysisStatus}</strong>
            {analysisElapsedSeconds > 0 ? (
              <span className="muted" style={{ display: "block", marginTop: 6 }}>
                {t("secondsElapsed", "({seconds} s)", { seconds: analysisElapsedSeconds })}
              </span>
            ) : null}
          </div>
        ) : null}
        {selectedIds.length > 6 ? (
          <div className="callout" style={{ marginTop: 12 }}>
            {t("manySelectedWarning", "Många bilder markerade. För bäst träffsäkerhet och snabbare svar rekommenderas oftast 2 till 6 bilder per analys.")}
          </div>
        ) : null}
        {analysisError ? <div className="callout">{analysisError}</div> : null}
        {suggestion ? (
          <div className="panel" style={{ marginTop: 18 }}>
            <h2>{t("aiSuggestion", "AI-förslag")}</h2>
            <div className="meta" style={{ marginBottom: 12 }}>
              <span>{t("source", "Källa: {value}", { value: suggestion.source })}</span>
              <span>{t("confidence", "Tillit: {value}", { value: suggestion.confidence })}</span>
              <span>{t("session", "Session: {value}", { value: suggestion.sessionId })}</span>
            </div>
            <div className="grid two">
              <div className="card">
                <div className="meta card-meta" style={{ marginBottom: 8 }}>
                  <h3 style={{ margin: 0 }}>{t("suggestion", "Förslag")}</h3>
                  {primaryMatch ? <span className="meta-count">{t("points", "{count} p", { count: primaryMatch.score })}</span> : null}
                </div>
                <p>
                  <strong>{t("boxName", "Lådnamn:")}</strong> {suggestion.suggestedLabel || t("unidentified", "Ej identifierat ännu")}
                </p>
                <p>
                  <strong>{t("location", "Plats:")}</strong>
                  {suggestion.suggestedLocationId ? (
                    <span className="meta card-meta inline-meta" style={{ marginLeft: 10 }}>
                      {renderLocationMeta(suggestion.suggestedLocationId, suggestion.suggestedBoxId)}
                    </span>
                  ) : (
                    ` ${t("unidentified", "Ej identifierat ännu")}`
                  )}
                </p>
                <p>{suggestion.suggestedSummary}</p>
                <div className="pill-row">
                  {suggestion.suggestedKeywords.map((keyword, index) => (
                    <span className="pill" key={`${keyword}-${index}`}>
                      {keyword}
                    </span>
                  ))}
                </div>
                {quickAttachHref ? (
                  <p style={{ marginTop: 18 }}>
                    <a className="button secondary" href={quickAttachHref}>
                      {t("attachBox", "Koppla låda")}
                    </a>
                  </p>
                ) : null}
              </div>
              <div className="card">
                <h3>{t("imageRolesAndOrder", "Bildroller och ordning")}</h3>
                <div className="card-list">
                  {suggestion.suggestedPhotos.map((photo, index) => (
                    <article className="card" key={photo.immichAssetId}>
                      <div className="analysis-photo-row">
                        <button
                          type="button"
                          className="analysis-image-button"
                          onClick={() =>
                            openLightbox({
                              id: photo.immichAssetId,
                              alt: t("imageNumber", "Bild {count}", { count: index + 1 }),
                              originalUrl: originalUrls[photo.immichAssetId],
                              title: t("imageNumber", "Bild {count}", { count: index + 1 }),
                              meta: formatDateTime(photo.capturedAt, locale, t("missingTime", "Tid saknas"))
                            })
                          }
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            alt={t("imageNumber", "Bild {count}", { count: index + 1 })}
                            className="analysis-thumb"
                            src={thumbnailUrls[photo.immichAssetId]}
                            loading="lazy"
                            decoding="async"
                          />
                        </button>
                        <div className="shell" style={{ gap: 12, minWidth: 0 }}>
                          <div className="meta">
                            <span>{t("imageNumber", "Bild {count}", { count: index + 1 })}</span>
                            <span>{formatDateTime(photo.capturedAt, locale, t("missingTime", "Tid saknas"))}</span>
                          </div>
                          <label className="inline-field">
                            {t("role", "Roll")}
                            <select
                              value={photo.photoRole}
                              onChange={(event) => updatePhotoRole(photo.immichAssetId, event.target.value as PhotoRole)}
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
                          </div>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            </div>
            {suggestion.matchCandidates.length > 0 ? (
              <div className="card" style={{ marginTop: 16 }}>
                <h3>{t("likelyBoxes", "Sannolika befintliga lådor")}</h3>
                <div className="card-list">
                  {suggestion.matchCandidates.map((candidate) => (
                    <article className="card" key={candidate.boxId}>
                      <div className="meta card-meta">
                        {renderLocationMeta(candidate.currentLocationId, candidate.boxId)}
                        <span className="meta-count">{t("points", "{count} p", { count: candidate.score })}</span>
                      </div>
                      <strong>{candidate.label}</strong>
                      <p>{candidate.summary || t("currentSummaryMissing", "Ingen aktuell sammanfattning ännu.")}</p>
                      <div className="pill-row">
                        {candidate.reasons.map((reason) => (
                          <span className="pill" key={`${candidate.boxId}-${reason}`}>
                            {reason}
                          </span>
                        ))}
                      </div>
                      <p style={{ marginTop: 12 }}>
                        <a className="button secondary" href={buildCandidateDraftHref(suggestion, candidate)}>
                          {t("attachExistingBox", "Koppla till befintlig låda")}
                        </a>
                      </p>
                    </article>
                  ))}
                </div>
              </div>
            ) : null}
            {suggestion.suggestedNotes ? <p className="muted">{suggestion.suggestedNotes}</p> : null}
            <p style={{ marginTop: 14 }}>
              <a className="button" href={buildDraftHref(suggestion)}>
                {t("createSessionFromSuggestion", "Skapa session från förslaget")}
              </a>
            </p>
          </div>
        ) : null}
      </section>

      <section className="panel">
        <h2>{t("latestAlbumImages", "Senaste bilderna i albumet")}</h2>
        {assets.length > 0 ? (
          <>
            <div className="meta" style={{ marginBottom: 14 }}>
              <span>
                {t("showingOfCount", "Visar {visible} av {total} bilder", {
                  visible: Math.min(visibleAssets.length, reversedAssets.length),
                  total: reversedAssets.length
                })}
              </span>
            </div>
            <div className="photo-grid">
            {visibleAssets.map((asset) => {
            const selected = selectedIds.includes(asset.id);

            return (
              <article
                className={`photo-card selectable-photo${selected ? " selected" : ""}`}
                key={asset.id}
              >
                <button
                  type="button"
                  className="select-toggle"
                  onClick={() => toggleAsset(asset.id)}
                  aria-pressed={selected}
                >
                  {selected ? t("selected", "Vald") : t("select", "Välj")}
                </button>
                <button
                  type="button"
                  className="photo-open"
                  onClick={() =>
                    openLightbox({
                      id: asset.id,
                      alt: asset.originalFileName,
                      originalUrl: originalUrls[asset.id],
                      title: t("image", "Bild"),
                      meta: new Date(asset.fileCreatedAt).toLocaleString(locale)
                    })
                  }
                  aria-label={t("openLargeImage", "Visa större bild: {name}", { name: asset.originalFileName })}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    alt={asset.originalFileName}
                    src={thumbnailUrls[asset.id]}
                    loading="lazy"
                    decoding="async"
                  />
                </button>
                <div className="body">
                  <div className="meta">
                    <span>{new Date(asset.fileCreatedAt).toLocaleString(locale)}</span>
                  </div>
                </div>
              </article>
            );
            })}
            </div>
            {visibleCount < reversedAssets.length ? (
              <div className="action-row" style={{ marginTop: 16 }}>
                <button
                  type="button"
                  className="button secondary"
                  onClick={() => setVisibleCount((current) => current + INBOX_PAGE_SIZE)}
                >
                  {t("showMoreImages", "Visa fler bilder")}
                </button>
              </div>
            ) : null}
          </>
        ) : (
          <div className="empty">{t("empty", "Inboxen är tom just nu. Alla bilder i albumet är redan kopplade eller så väntar vi på nästa import från mobilen.")}</div>
        )}
      </section>

      {activePhoto ? (
        <div className="lightbox-overlay" role="dialog" aria-modal="true" onClick={() => setActivePhoto(null)}>
          <div className="lightbox-panel" onClick={(event) => event.stopPropagation()}>
            <button
              type="button"
              className="lightbox-close"
              onClick={() => setActivePhoto(null)}
              aria-label={t("closeImageView", "Stäng bildvisning")}
            >
              X
            </button>
            <div className="lightbox-meta">
              <strong>{activePhoto.title}</strong>
              <span>{activePhoto.meta}</span>
            </div>
            <div className="lightbox-image-wrap">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img alt={activePhoto.alt} className="lightbox-image" src={activePhoto.originalUrl} decoding="async" />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
