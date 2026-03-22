"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { CSSProperties } from "react";

type ImageLightboxButtonProps = {
  alt: string;
  thumbnailUrl: string;
  originalUrl: string;
  buttonClassName?: string;
  imageClassName?: string;
  overlayTitle?: string;
  overlayMeta?: string;
  overlayNote?: string;
  showAnalysisBadge?: boolean;
};

export function ImageLightboxButton({
  alt,
  thumbnailUrl,
  originalUrl,
  buttonClassName = "photo-open",
  imageClassName,
  overlayTitle,
  overlayMeta,
  overlayNote,
  showAnalysisBadge = false
}: ImageLightboxButtonProps) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [measuredWidth, setMeasuredWidth] = useState<number | null>(null);
  const [imageMaxHeight, setImageMaxHeight] = useState<number | null>(null);
  const [layoutReady, setLayoutReady] = useState(false);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const metaRef = useRef<HTMLDivElement | null>(null);
  const noteRef = useRef<HTMLParagraphElement | null>(null);

  function updateLayoutMeasurements() {
    const width = imageRef.current?.getBoundingClientRect().width ?? 0;
    if (width > 0) {
      setMeasuredWidth(Math.round(width));
    }

    const viewportHeight = window.innerHeight;
    const closeHeight = closeButtonRef.current?.getBoundingClientRect().height ?? 0;
    const metaHeight = metaRef.current?.getBoundingClientRect().height ?? 0;
    const noteHeight = noteRef.current?.getBoundingClientRect().height ?? 0;
    const reservedHeight = closeHeight + metaHeight + noteHeight + 140;
    const availableHeight = Math.max(180, Math.floor(viewportHeight - reservedHeight));
    setImageMaxHeight(availableHeight);
    if (width > 0 && availableHeight > 0) {
      setLayoutReady(true);
    }
  }

  function closeOverlay(event?: { preventDefault?: () => void; stopPropagation?: () => void }) {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    setOpen(false);
  }

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    function onResize() {
      updateLayoutMeasurements();
    }

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", onResize);
    window.requestAnimationFrame(() => updateLayoutMeasurements());
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", onResize);
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      setMeasuredWidth(null);
      setImageMaxHeight(null);
      setLayoutReady(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const frame = window.requestAnimationFrame(() => updateLayoutMeasurements());
    return () => window.cancelAnimationFrame(frame);
  }, [open, measuredWidth, overlayNote]);

  const contentStyle = measuredWidth
    ? ({
        width: `${measuredWidth}px`,
        maxWidth: `${measuredWidth}px`
      } satisfies CSSProperties)
    : undefined;
  const imageStyle = imageMaxHeight
    ? ({
        maxHeight: `${imageMaxHeight}px`
      } satisfies CSSProperties)
    : undefined;
  const panelStyle = !layoutReady
    ? ({
        visibility: "hidden"
      } satisfies CSSProperties)
    : undefined;

  return (
    <>
      <button
        type="button"
        className={buttonClassName}
        onClick={(event) => {
          event.stopPropagation();
          setOpen(true);
        }}
        aria-label={`Visa större bild: ${alt}`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img alt={alt} className={imageClassName} src={thumbnailUrl} loading="lazy" decoding="async" />
        {showAnalysisBadge ? (
          <span className="analysis-badge" aria-label="Bilden har analystext">
            ✓
          </span>
        ) : null}
      </button>

      {open && mounted
        ? createPortal(
        <div
          className="lightbox-overlay"
          role="dialog"
          aria-modal="true"
          onMouseDown={closeOverlay}
          onClick={closeOverlay}
        >
          <div className="lightbox-panel" onClick={(event) => event.stopPropagation()}>
            <button
              ref={closeButtonRef}
              type="button"
              className="lightbox-close"
              onClick={closeOverlay}
              aria-label="Stäng bildvisning"
            >
              X
            </button>
            {overlayTitle || overlayMeta ? (
              <div ref={metaRef} className="lightbox-meta">
                {overlayTitle ? <strong>{overlayTitle}</strong> : null}
                {overlayMeta ? <span>{overlayMeta}</span> : null}
              </div>
            ) : null}
            <div className="lightbox-content-column" style={{ ...(contentStyle ?? {}), ...(panelStyle ?? {}) }}>
              <div className="lightbox-image-wrap">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  ref={imageRef}
                  alt={alt}
                  className="lightbox-image"
                  src={originalUrl}
                  decoding="async"
                  onLoad={updateLayoutMeasurements}
                  style={imageStyle}
                />
              </div>
              {overlayNote?.trim() ? (
                <p ref={noteRef} className="photo-note">
                  {overlayNote.trim()}
                </p>
              ) : null}
            </div>
          </div>
        </div>,
          document.body
        )
        : null}
    </>
  );
}
