import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentSessionByBox, readInventoryData } from "@/lib/data-store";
import { fetchAlbumAssets, getAssetOriginalUrl, getAssetThumbnailUrl } from "@/lib/immich";
import { presentLocation } from "@/lib/location-presentation";
import { AttachPhotosForm } from "@/app/boxes/[boxId]/attach-photos-form";
import { PhotoLightbox } from "@/app/boxes/[boxId]/photo-lightbox";

type BoxPageProps = {
  params: Promise<{ boxId: string }>;
};

export default async function BoxPage({ params }: BoxPageProps) {
  const { boxId } = await params;
  if (boxId.startsWith("BOX-")) {
    redirect(`/boxes/IVAR-${boxId.slice(4)}`);
  }
  const [data, albumAssets] = await Promise.all([readInventoryData(), fetchAlbumAssets()]);
  const box = data.boxes.find((entry) => entry.boxId === boxId);

  if (!box) {
    notFound();
  }

  const currentSessionsByBox = getCurrentSessionByBox(data);
  const currentSession = currentSessionsByBox.get(box.boxId);
  const sessions = data.sessions
    .filter((session) => session.boxId === box.boxId)
    .sort((a, b) => {
      if (currentSession?.sessionId === a.sessionId) return -1;
      if (currentSession?.sessionId === b.sessionId) return 1;
      return b.createdAt.localeCompare(a.createdAt);
    });

  const photos = currentSession
    ? data.photos.filter((photo) => photo.sessionId === currentSession.sessionId)
    : [];
  const usedAssetIds = new Set(data.photos.map((photo) => photo.immichAssetId));
  const unassignedAssets = albumAssets.filter((asset) => !usedAssetIds.has(asset.id));
  const thumbnailUrls = Object.fromEntries(
    unassignedAssets.map((asset) => [asset.id, getAssetThumbnailUrl(asset.id)])
  );
  const originalUrls = Object.fromEntries(
    unassignedAssets.map((asset) => [asset.id, getAssetOriginalUrl(asset.id)])
  );
  const boxMeta = presentLocation(box.currentLocationId, box.boxId);

  return (
    <div className="shell">
      <section className="hero">
        <div className="meta card-meta">
          <span>{boxMeta.system}</span>
          <span>{boxMeta.shelf}</span>
          <span>{boxMeta.slot}</span>
        </div>
        <h1>{box.label}</h1>
        <p>{currentSession?.summary ?? "Ingen session har sparats än för den här lådan."}</p>
        <div className="pill-row">
          {(currentSession?.itemKeywords ?? []).map((keyword) => (
            <span className="pill" key={keyword}>
              {keyword}
            </span>
          ))}
        </div>
        <p style={{ marginTop: 14 }}>
          <Link className="button" href="/boxes/new">
            Ny inventering för lådan
          </Link>
        </p>
        <p style={{ marginTop: 10 }}>
          <Link className="button secondary" href={`/labels?boxId=${encodeURIComponent(box.boxId)}`}>
            Skapa etikett
          </Link>
        </p>
        {currentSession ? (
          <p style={{ marginTop: 10 }}>
            <Link className="button secondary" href={`/boxes/new?boxId=${encodeURIComponent(box.boxId)}`}>
              Redigera aktuell session
            </Link>
          </p>
        ) : null}
      </section>

      <section className="panel">
        <h2>Bilder i aktuell session</h2>
        {currentSession ? (
          <>
            <p>
              <strong>Session:</strong> {currentSession.sessionId}
            </p>
            <p>
              <strong>Skapad:</strong> {new Date(currentSession.createdAt).toLocaleString("sv-SE")}
            </p>
          </>
        ) : null}
        {photos.length > 0 ? (
          <PhotoLightbox
            gridClassName="session-photo-grid"
            boxLabel={box.label}
            photos={photos.map((photo) => ({
              photoId: photo.photoId,
              immichAssetId: photo.immichAssetId,
              photoRole: photo.photoRole,
              capturedAt: photo.capturedAt,
              notes: photo.notes,
              thumbnailUrl: getAssetThumbnailUrl(photo.immichAssetId),
              originalUrl: getAssetOriginalUrl(photo.immichAssetId)
            }))}
          />
        ) : (
          <div className="empty">Inga bilder kopplade till aktuell session ännu.</div>
        )}
      </section>

      <section className="grid two">
        <section className="panel">
          <h2>Aktuell session</h2>
          {currentSession ? (
            <>
              {currentSession.notes ? <p>{currentSession.notes}</p> : null}
              {!currentSession.notes ? <div className="empty">Inga extra noteringar för den aktuella sessionen.</div> : null}
            </>
          ) : (
            <div className="empty">Ingen session ännu.</div>
          )}
        </section>

        <section className="panel">
          <h2>Historik</h2>
          <div className="card-list">
            {sessions.map((session) => (
              <article className="card" key={session.sessionId}>
                <div className="meta">
                  <span>{session.sessionId}</span>
                  <span>{session.isCurrent ? "Aktuell" : "Historisk"}</span>
                </div>
                <p>{session.summary}</p>
              </article>
            ))}
          </div>
        </section>
      </section>

      {currentSession ? (
        <section className="panel">
          <h2>Lägg till fler bilder till aktuell session</h2>
          <p>
            Välj bland bilder i Immich-albumet som ännu inte är kopplade till någon låda, sätt en
            bildroll och lägg till dem direkt härifrån.
          </p>
          <AttachPhotosForm
            boxId={box.boxId}
            sessionId={currentSession.sessionId}
            assets={unassignedAssets}
            thumbnailUrls={thumbnailUrls}
            originalUrls={originalUrls}
          />
        </section>
      ) : null}
    </div>
  );
}
