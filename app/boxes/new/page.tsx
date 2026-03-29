import { SessionForm } from "@/app/boxes/new/session-form";
import { getCurrentSessionByBox, readInventoryData } from "@/lib/data-store";
import { createTranslator } from "@/lib/i18n";
import { fetchAlbumDetails, getAssetOriginalUrl, getAssetThumbnailUrl } from "@/lib/immich";
import { readResolvedLanguageCatalog } from "@/lib/request-language";
import { readAppSettings } from "@/lib/settings";
import type { PhotoRole } from "@/lib/types";

type NewBoxPageProps = {
  searchParams: Promise<{
    boxId?: string;
    label?: string;
    currentLocationId?: string;
    sessionId?: string;
    createdAt?: string;
    summary?: string;
    itemKeywords?: string;
    photoRows?: string;
    photoPayload?: string;
    notes?: string;
    duplicateWarning?: string;
  }>;
};

export default async function NewBoxPage({ searchParams }: NewBoxPageProps) {
  const params = await searchParams;
  const [album, data, settings] = await Promise.all([
    fetchAlbumDetails().catch(() => ({ id: "", assets: [], albumThumbnailAssetId: "", albumName: "" })),
    readInventoryData(),
    readAppSettings()
  ]);
  const languageCatalog = await readResolvedLanguageCatalog(settings.appearance.language);
  const t = createTranslator(languageCatalog);
  const currentSessionsByBox = getCurrentSessionByBox(data);
  const existingBox = params.boxId ? data.boxes.find((box) => box.boxId === params.boxId) ?? null : null;
  const existingSession = existingBox ? currentSessionsByBox.get(existingBox.boxId) ?? null : null;
  const initialPhotos = (() => {
    const payload = String(params.photoPayload ?? "").trim();

    if (payload) {
      try {
        const parsed = JSON.parse(payload) as Array<{
          photoId?: string;
          immichAssetId: string;
          photoRole?: string;
          capturedAt?: string;
          notes?: string;
        }>;

        return parsed.map((photo) => ({
          photoId: photo.photoId,
          immichAssetId: photo.immichAssetId,
          photoRole: ((photo.photoRole || "inside") as PhotoRole),
          capturedAt: photo.capturedAt || undefined,
          notes: photo.notes || "",
          thumbnailUrl: getAssetThumbnailUrl(photo.immichAssetId),
          originalUrl: getAssetOriginalUrl(photo.immichAssetId)
        }));
      } catch {
        // Fallback to legacy photoRows parsing below.
      }
    }

    if (existingSession) {
      return data.photos
        .filter((photo) => photo.sessionId === existingSession.sessionId)
        .map((photo) => ({
          photoId: photo.photoId,
          immichAssetId: photo.immichAssetId,
          photoRole: photo.photoRole,
          capturedAt: photo.capturedAt || undefined,
          notes: photo.notes || "",
          thumbnailUrl: getAssetThumbnailUrl(photo.immichAssetId),
          originalUrl: getAssetOriginalUrl(photo.immichAssetId)
        }));
    }

    return String(params.photoRows ?? "")
      .split("\n")
      .map((row) => row.trim())
      .filter(Boolean)
      .map((row) => {
        const [immichAssetId, photoRole, capturedAt] = row.split("|").map((part) => part.trim());
        return {
          immichAssetId,
          photoRole: ((photoRole || "inside") as PhotoRole),
          capturedAt: capturedAt || undefined,
          notes: "",
          thumbnailUrl: getAssetThumbnailUrl(immichAssetId),
          originalUrl: getAssetOriginalUrl(immichAssetId)
        };
      });
  })();
  const currentSessionIds = new Set([...getCurrentSessionByBox(data).values()].map((session) => session.sessionId));
  const mappedAssetIds = new Set(
    data.photos
      .filter((photo) => currentSessionIds.has(photo.sessionId))
      .map((photo) => photo.immichAssetId)
  );
  for (const photo of initialPhotos) {
    mappedAssetIds.add(photo.immichAssetId);
  }
  const coverAssetId = album.albumThumbnailAssetId?.trim() || "";
  const availablePhotos = album.assets
    .filter((asset) => asset.id !== coverAssetId && !mappedAssetIds.has(asset.id))
    .map((asset) => ({
      immichAssetId: asset.id,
      capturedAt: asset.fileCreatedAt,
      thumbnailUrl: getAssetThumbnailUrl(asset.id),
      originalUrl: getAssetOriginalUrl(asset.id)
    }));

  return (
    <div className="shell">
      <section className="hero">
        <h1>{t("boxForm.pageTitle", "Ny låda eller ny inventeringssession")}</h1>
        {params.summary ? (
          <div className="callout">
            {t("boxForm.analysisLoaded", "Analysförslag inläst. Gå igenom fälten, justera det som behövs och spara sedan sessionen.")}
          </div>
        ) : null}
        {params.duplicateWarning ? (
          <div className="callout">
            {params.duplicateWarning}
          </div>
        ) : null}
      </section>

      <section className="panel">
        <h2>{t("boxForm.registerOrUpdate", "Registrera eller uppdatera")}</h2>
        <form action="/api/boxes/save-session" method="post">
          <SessionForm
            defaults={{
              boxId: params.boxId ?? existingBox?.boxId ?? "",
              label: params.label ?? existingBox?.label ?? "",
              currentLocationId: params.currentLocationId ?? existingBox?.currentLocationId ?? "",
              sessionId: params.sessionId ?? existingSession?.sessionId ?? "",
              createdAt: params.createdAt ?? existingSession?.createdAt ?? "",
              summary: params.summary ?? existingSession?.summary ?? "",
              itemKeywords: params.itemKeywords ?? existingSession?.itemKeywords.join(", ") ?? "",
              notes: params.notes ?? existingSession?.notes ?? "",
              duplicateWarning: params.duplicateWarning ?? ""
            }}
            initialPhotos={initialPhotos}
            availablePhotos={availablePhotos}
            existingBoxes={data.boxes.map((box) => ({
              boxId: box.boxId,
              label: box.label,
              currentLocationId: box.currentLocationId
            }))}
            locale={languageCatalog._meta.htmlLang}
            ui={{
              missingTime: t("shared.missingTime", "Tid saknas"),
              locationLabel: t("boxForm.locationLabel", "Aktuell plats"),
              noLocationSelected: t("boxForm.noLocationSelected", "Ingen plats vald ännu."),
              changeLocation: t("boxForm.changeLocation", "Ändra plats"),
              locationCategory: t("boxForm.locationCategory", "Platskategori"),
              ivar: t("boxForm.ivar", "Lagerhylla"),
              bench: t("boxForm.bench", "Bänk"),
              cabinet: t("boxForm.cabinet", "Skåp"),
              selectIvar: t("boxForm.selectIvar", "Välj lagerhylla"),
              selectShelf: t("boxForm.selectShelf", "Välj hylla"),
              selectSlot: t("boxForm.selectSlot", "Välj plats"),
              noLetter: t("boxForm.noLetter", "Ingen"),
              place: t("boxForm.place", "Plats"),
              letter: t("boxForm.letter", "Bokstav"),
              surface: t("boxForm.surface", "Yta"),
              shelf: t("boxForm.shelf", "Hylla"),
              doneWithLocation: t("boxForm.doneWithLocation", "Klar med plats"),
              cancel: t("shared.cancel", "Avbryt"),
              labelName: t("boxForm.labelName", "Etikett / lådnamn"),
              labelPlaceholder: t("boxForm.labelPlaceholder", "Adaptrar"),
              summary: t("boxForm.summary", "Sammanfattning"),
              summaryPlaceholder: t("boxForm.summaryPlaceholder", "Kort beskrivning av vad lådan innehåller just nu."),
              keywords: t("boxForm.keywords", "Sökord"),
              keywordsPlaceholder: t("boxForm.keywordsPlaceholder", "adaptrar, usb, ljud, rca, bnc"),
              notes: t("boxForm.notes", "Noteringar"),
              notesPlaceholder: t("boxForm.notesPlaceholder", "Valfria noteringar om lådan eller inventeringen."),
              saveSession: t("boxForm.saveSession", "Spara session"),
              imagesTitle: t("boxForm.imagesTitle", "Immich-bilder"),
              noImagesSelected: t("boxForm.noImagesSelected", "Inga bilder valda ännu."),
              imageNumber: t("shared.imageNumber", "Bild {count}"),
              role: t("shared.role", "Roll"),
              moveUp: t("shared.moveUp", "Flytta upp"),
              moveDown: t("shared.moveDown", "Flytta ner"),
              removeImage: t("boxForm.removeImage", "Ta bort bild"),
              analysisText: t("boxForm.analysisText", "Analystext"),
              analyzeImage: t("boxForm.analyzeImage", "Analysera bild"),
              analyzingImage: t("boxForm.analyzingImage", "Analyserar..."),
              reset: t("shared.reset", "Återställ"),
              clearAnalysis: t("boxForm.clearAnalysis", "Rensa analys"),
              selectImagesFromAlbum: t("boxForm.selectImagesFromAlbum", "Välj bilder från albumet"),
              selectedCount: t("boxForm.selectedCount", "{count} valda bilder"),
              addSelectedImages: t("boxForm.addSelectedImages", "Lägg till valda bilder"),
              selected: t("shared.selected", "Vald"),
              select: t("shared.select", "Välj"),
              availableAlbumImage: t("boxForm.availableAlbumImage", "Tillgänglig album-bild"),
              albumImage: t("boxForm.albumImage", "Album-bild"),
              noAvailableImages: t("boxForm.noAvailableImages", "Det finns inga lediga bilder kvar att välja just nu."),
              markedImagesFollow: t("boxForm.markedImagesFollow", "Markerade album-bilder följer med när du sparar sessionen, även om du inte först klickar på `Lägg till valda bilder`."),
              startPhotoAnalysis: t("boxForm.startPhotoAnalysis", "Startar bildanalys..."),
              photoAnalysisFailed: t("boxForm.photoAnalysisFailed", "Bildanalysen misslyckades."),
              analyzingPhoto: t("boxForm.analyzingPhoto", "Analyserar bild..."),
              duplicateOne: t("boxForm.duplicateOne", "Det finns redan en låda med samma namn på den här platsen. Välj en annan bokstav eller redigera den befintliga lådan istället."),
              duplicateMany: t("boxForm.duplicateMany", "Det finns redan lådor med samma namn på den här platsen. Välj en annan bokstav eller redigera den befintliga lådan istället."),
              exactConflictOne: t("boxForm.exactConflictOne", "Varning: platsen används redan av {label} ({boxId}). Om du sparar som ny låda måste du välja en annan bokstav eller en annan plats."),
              exactConflictMany: t("boxForm.exactConflictMany", "Varning: platsen används redan av {count} lådor. Om du sparar som ny låda måste du välja en annan bokstav eller en annan plats."),
              secondsElapsed: t("shared.secondsElapsed", "({seconds} s)"),
              benchTop: t("boxForm.benchTop", "Ovanpå"),
              benchUnder: t("boxForm.benchUnder", "Under")
            }}
          />
        </form>
      </section>
    </div>
  );
}
