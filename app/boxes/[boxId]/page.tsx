import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentSessionByBox, readInventoryData } from "@/lib/data-store";
import { createTranslator, readLanguageCatalog } from "@/lib/i18n";
import { fetchAlbumAssets, getAssetOriginalUrl, getAssetThumbnailUrl } from "@/lib/immich";
import { presentLocation } from "@/lib/location-presentation";
import { readAppSettings } from "@/lib/settings";
import { AttachPhotosForm } from "@/app/boxes/[boxId]/attach-photos-form";
import { DeleteBoxForm } from "@/app/boxes/[boxId]/delete-box-form";
import { PhotoLightbox } from "@/app/boxes/[boxId]/photo-lightbox";

type BoxPageProps = {
  params: Promise<{ boxId: string }>;
};

export default async function BoxPage({ params }: BoxPageProps) {
  const { boxId } = await params;
  if (boxId.startsWith("BOX-")) {
    redirect(`/boxes/IVAR-${boxId.slice(4)}`);
  }
  const [data, albumAssets, settings] = await Promise.all([readInventoryData(), fetchAlbumAssets(), readAppSettings()]);
  const languageCatalog = await readLanguageCatalog(settings.appearance.language);
  const t = createTranslator(languageCatalog);
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
  const boxMeta = presentLocation(box.currentLocationId, box.boxId, {
    shelvingUnit: t("boxForm.ivar", "Lagerhylla"),
    bench: t("boxForm.bench", "Bänk"),
    cabinet: t("boxForm.cabinet", "Skåp"),
    surface: t("boxForm.surface", "Yta"),
    slot: t("boxForm.place", "Plats")
  });

  return (
    <div className="shell">
      <section className="hero">
        <div className="meta card-meta">
          <span>{boxMeta.system}</span>
          <span>{boxMeta.shelf}</span>
          <span>{boxMeta.slot}</span>
        </div>
        <h1>{box.label}</h1>
        <p>{currentSession?.summary ?? t("boxPage.noSavedSession", "Ingen session har sparats än för den här lådan.")}</p>
        <div className="pill-row">
          {(currentSession?.itemKeywords ?? []).map((keyword, index) => (
            <span className="pill" key={`${keyword}-${index}`}>
              {keyword}
            </span>
          ))}
        </div>
        <p style={{ marginTop: 14 }}>
          <Link className="button" href="/boxes/new">
            {t("boxPage.newInventoryForBox", "Ny inventering för lådan")}
          </Link>
        </p>
        <p style={{ marginTop: 10 }}>
          <Link className="button secondary" href={`/labels?boxId=${encodeURIComponent(box.boxId)}`}>
            {t("boxPage.createLabel", "Skapa etikett")}
          </Link>
        </p>
        {currentSession ? (
          <p style={{ marginTop: 10 }}>
            <Link className="button secondary" href={`/boxes/new?boxId=${encodeURIComponent(box.boxId)}`}>
              {t("boxPage.editCurrentSession", "Redigera aktuell session")}
            </Link>
          </p>
        ) : null}
      </section>

      <section className="panel">
        <h2>{t("boxPage.imagesInCurrentSession", "Bilder i aktuell session")}</h2>
        {currentSession ? (
          <>
            <p>
              <strong>{t("boxPage.sessionLabel", "Session:")}</strong> {currentSession.sessionId}
            </p>
            <p>
              <strong>{t("boxPage.createdLabel", "Skapad:")}</strong> {new Date(currentSession.createdAt).toLocaleString(languageCatalog._meta.htmlLang)}
            </p>
          </>
        ) : null}
        {photos.length > 0 ? (
          <PhotoLightbox
            gridClassName="session-photo-grid"
            boxLabel={box.label}
            locale={languageCatalog._meta.htmlLang}
            ui={{
              missingTime: t("shared.missingTime", "Tid saknas"),
              analysisText: t("boxPage.analysisText", "Analystext"),
              startPhotoAnalysis: t("boxForm.startPhotoAnalysis", "Startar bildanalys..."),
              analyzeImage: t("boxForm.analyzeImage", "Analysera bild"),
              analyzingImage: t("boxForm.analyzingImage", "Analyserar..."),
              photoAnalysisFailed: t("boxForm.photoAnalysisFailed", "Bildanalysen misslyckades."),
              analyzingPhoto: t("boxForm.analyzingPhoto", "Analyserar bild..."),
              saveText: t("boxPage.saveText", "Spara text"),
              saving: t("shared.saving", "Sparar..."),
              saveTextFailed: t("boxPage.saveTextFailed", "Kunde inte spara analystexten."),
              clearAnalysisFailed: t("boxPage.clearAnalysisFailed", "Kunde inte rensa bildanalysen."),
              clearAnalysis: t("boxForm.clearAnalysis", "Rensa analys"),
              releaseImage: t("boxPage.releaseImage", "Släpp bild"),
              releaseImageFailed: t("boxPage.releaseImageFailed", "Kunde inte släppa bilden."),
              reset: t("shared.reset", "Återställ"),
              closeImageView: t("shared.closeImageView", "Stäng bildvisning"),
              secondsElapsed: t("shared.secondsElapsed", "({seconds} s)")
            }}
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
          <div className="empty">{t("boxPage.noImagesYet", "Inga bilder kopplade till aktuell session ännu.")}</div>
        )}
      </section>

      <section className="grid two">
        <section className="panel">
          <h2>{t("boxPage.currentSession", "Aktuell session")}</h2>
          {currentSession ? (
            <>
              {currentSession.notes ? <p>{currentSession.notes}</p> : null}
              {!currentSession.notes ? <div className="empty">{t("boxPage.noSessionNotes", "Inga extra noteringar för den aktuella sessionen.")}</div> : null}
            </>
          ) : (
            <div className="empty">{t("boxPage.noSessionYet", "Ingen session ännu.")}</div>
          )}
        </section>

        <section className="panel">
          <h2>{t("boxPage.history", "Historik")}</h2>
          <div className="card-list">
            {sessions.map((session) => (
              <article className="card" key={session.sessionId}>
                <div className="meta">
                  <span>{session.sessionId}</span>
                  <span>{session.isCurrent ? t("boxPage.currentStatus", "Aktuell") : t("boxPage.historicStatus", "Historisk")}</span>
                </div>
                <p>{session.summary}</p>
              </article>
            ))}
          </div>
        </section>
      </section>

      {currentSession ? (
        <section className="panel">
          <h2>{t("boxPage.addMoreImages", "Lägg till fler bilder till aktuell session")}</h2>
          <p>{t("boxPage.addMoreImagesIntro", "Välj bland bilder i Immich-albumet som ännu inte är kopplade till någon låda, sätt en bildroll och lägg till dem direkt härifrån.")}</p>
          <AttachPhotosForm
            boxId={box.boxId}
            sessionId={currentSession.sessionId}
            assets={unassignedAssets}
            thumbnailUrls={thumbnailUrls}
            originalUrls={originalUrls}
            locale={languageCatalog._meta.htmlLang}
            ui={{
              addSelectedImages: t("boxForm.addSelectedImages", "Lägg till markerade bilder"),
              selectedCount: t("boxForm.selectedCount", "{count} valda bilder"),
              selected: t("shared.selected", "Vald"),
              select: t("shared.select", "Välj"),
              role: t("shared.role", "Roll"),
              noUnassignedImages: t("boxPage.noUnassignedImages", "Det finns inga okopplade bilder kvar att lägga till just nu.")
            }}
          />
        </section>
      ) : null}

      <section className="panel">
        <h2>{t("boxPage.deleteTitle", "Delete box")}</h2>
        <p>
          {t(
            "boxPage.deleteIntro",
            "This removes the box, all of its inventory sessions, and all linked image references from the app. The actual images remain in the photo source."
          )}
        </p>
        <p className="muted">
          {t(
            "boxPage.deleteLocationNote",
            "Locations are derived from the stored boxes, so an unused location disappears automatically when no box is left there."
          )}
        </p>
        <DeleteBoxForm
          boxId={box.boxId}
          ui={{
            delete: t("boxPage.deleteButton", "Delete box"),
            deleting: t("boxPage.deletingButton", "Deleting..."),
            confirm: t(
              "boxPage.deleteConfirm",
              "Delete this box and all of its sessions from the app? The linked images in the photo source will not be deleted."
            )
          }}
        />
      </section>
    </div>
  );
}
