"use client";

import { useRouter } from "next/navigation";
import { ImageLightboxButton } from "@/app/components/image-lightbox-button";

type PresentedLocation = {
  system: string;
  shelf: string;
  slot: string;
};

type CardPhoto = {
  photoId: string;
  thumbnailUrl: string;
  originalUrl: string;
  photoRole?: string;
  hasNotes?: boolean;
  notes?: string;
};

type HomeBoxCardProps = {
  href: string;
  label: string;
  summary: string;
  keywords: string[];
  photoCount: number;
  location: PresentedLocation;
  photos: CardPhoto[];
  ui?: {
    openBox?: string;
    photosCount?: string;
    openLargeImage?: string;
    imageHasAnalysisText?: string;
    closeImageView?: string;
  };
};

function renderLocationChip(value: string) {
  const match = value.match(/^([^:]+?)(?::\s*|\s+)(.+)$/);
  if (!match) {
    return <span className="location-chip">{value}</span>;
  }

  const [, label, detail] = match;

  return (
    <span className="location-chip">
      <span className="location-chip-label">{label}:</span>{" "}
      <span className="location-chip-value">{detail}</span>
    </span>
  );
}

export function HomeBoxCard({
  href,
  label,
  summary,
  keywords,
  photoCount,
  location,
  photos,
  ui
}: HomeBoxCardProps) {
  const router = useRouter();
  const primaryPhoto = photos.find((photo) => photo.photoRole === "inside") ?? null;
  const secondaryPhotos = primaryPhoto
    ? photos.filter((photo) => photo.photoId !== primaryPhoto.photoId)
    : photos;
  const visibleSecondaryPhotos = secondaryPhotos.slice(0, 6);

  return (
    <article
      className="card clickable-card"
      onClick={() => router.push(href)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          router.push(href);
        }
      }}
      role="link"
      tabIndex={0}
      aria-label={(ui?.openBox ?? "Öppna {label}").replace("{label}", label)}
    >
      <div className="meta card-meta location-meta">
        {renderLocationChip(location.system)}
        {renderLocationChip(location.shelf)}
        {renderLocationChip(location.slot)}
        <span className="meta-count">{(ui?.photosCount ?? "Bilder {count}").replace("{count}", String(photoCount))}</span>
      </div>
      <div className={`home-card-layout${primaryPhoto ? " has-primary-photo" : ""}`}>
        <div className="home-card-content">
          <h3>{label}</h3>
          <p>{summary}</p>
          {keywords.length > 0 ? (
            <div className="pill-row">
              {keywords.map((keyword) => (
                <span className="pill" key={keyword}>
                  {keyword}
                </span>
              ))}
            </div>
          ) : null}
          {visibleSecondaryPhotos.length > 0 ? (
            <div className="thumb-strip">
              {visibleSecondaryPhotos.map((photo) => (
                <ImageLightboxButton
                  key={photo.photoId}
                  alt={label}
                  buttonClassName="thumb-link"
                  thumbnailUrl={photo.thumbnailUrl}
                  originalUrl={photo.originalUrl}
                  overlayTitle={label}
                  overlayMeta={photo.photoRole}
                  overlayNote={photo.notes}
                  showAnalysisBadge={photo.hasNotes}
                  ui={{
                    openLargeImage: ui?.openLargeImage,
                    imageHasAnalysisText: ui?.imageHasAnalysisText,
                    closeImageView: ui?.closeImageView
                  }}
                />
              ))}
            </div>
          ) : null}
        </div>
        {primaryPhoto ? (
          <div className="home-card-primary-photo">
            <ImageLightboxButton
              alt={label}
              buttonClassName="home-card-primary-link"
              imageClassName="home-card-primary-image"
              thumbnailUrl={primaryPhoto.thumbnailUrl}
              originalUrl={primaryPhoto.originalUrl}
              overlayTitle={label}
              overlayMeta={primaryPhoto.photoRole}
              overlayNote={primaryPhoto.notes}
              showAnalysisBadge={primaryPhoto.hasNotes}
              ui={{
                openLargeImage: ui?.openLargeImage,
                imageHasAnalysisText: ui?.imageHasAnalysisText,
                closeImageView: ui?.closeImageView
              }}
            />
          </div>
        ) : null}
      </div>
    </article>
  );
}
