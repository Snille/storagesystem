import { getCurrentSessionByBox, readInventoryData } from "@/lib/data-store";
import { getUnmappedInboxAssets } from "@/lib/album-assets";
import { createTranslator, readLanguageCatalog } from "@/lib/i18n";
import { fetchAlbumDetails, getAssetOriginalUrl, getAssetThumbnailUrl } from "@/lib/immich";
import { readAppSettings } from "@/lib/settings";
import { InboxWorkspace } from "@/app/inbox/inbox-workspace";

export default async function InboxPage() {
  const [album, data, settings] = await Promise.all([fetchAlbumDetails(), readInventoryData(), readAppSettings()]);
  const languageCatalog = await readLanguageCatalog(settings.appearance.language);
  const t = createTranslator(languageCatalog);
  const currentSessionIds = new Set([...getCurrentSessionByBox(data).values()].map((session) => session.sessionId));
  const mappedAssetIds = new Set<string>(
    data.photos
      .filter((photo) => currentSessionIds.has(photo.sessionId))
      .map((photo) => photo.immichAssetId)
  );
  const inboxAssets = getUnmappedInboxAssets(album, mappedAssetIds);
  const thumbnailUrls = Object.fromEntries(inboxAssets.map((asset) => [asset.id, getAssetThumbnailUrl(asset.id)]));
  const originalUrls = Object.fromEntries(inboxAssets.map((asset) => [asset.id, getAssetOriginalUrl(asset.id)]));

  return (
    <InboxWorkspace
      assets={inboxAssets}
      thumbnailUrls={thumbnailUrls}
      originalUrls={originalUrls}
      locale={languageCatalog._meta.htmlLang}
      ui={{
        missingTime: t("shared.missingTime", "Tid saknas"),
        selectImageFirst: t("inbox.selectImageFirst", "Välj minst en bild först."),
        startingAnalysis: t("inbox.startingAnalysis", "Startar analys..."),
        analysisFailed: t("inbox.analysisFailed", "Analysen misslyckades."),
        analyzing: t("inbox.analyzing", "Analyserar..."),
        title: t("inbox.title", "Bilder att koppla"),
        intro: t("inbox.intro", "Här visas bara nya bilder som ännu inte är kopplade till någon låda. Markera de bilder som hör till samma låda och låt appen föreslå en inventeringssession."),
        analyzeSelection: t("inbox.analyzeSelection", "Analysera markerade bilder"),
        analyzingButton: t("inbox.analyzingButton", "Analyserar..."),
        selectedCount: t("inbox.selectedCount", "{count} valda bilder"),
        secondsElapsed: t("shared.secondsElapsed", "({seconds} s)"),
        manySelectedWarning: t("inbox.manySelectedWarning", "Många bilder markerade. För bäst träffsäkerhet och snabbare svar rekommenderas oftast 2 till 6 bilder per analys."),
        aiSuggestion: t("inbox.aiSuggestion", "AI-förslag"),
        source: t("inbox.source", "Källa: {value}"),
        confidence: t("inbox.confidence", "Tillit: {value}"),
        session: t("inbox.session", "Session: {value}"),
        suggestion: t("inbox.suggestion", "Förslag"),
        points: t("shared.points", "{count} p"),
        boxName: t("inbox.boxName", "Lådnamn:"),
        unidentified: t("inbox.unidentified", "Ej identifierat ännu"),
        location: t("inbox.location", "Plats:"),
        shelvingUnit: t("boxForm.ivar", "Lagerhylla"),
        bench: t("boxForm.bench", "Bänk"),
        cabinet: t("boxForm.cabinet", "Skåp"),
        surface: t("boxForm.surface", "Yta"),
        slot: t("boxForm.place", "Plats"),
        attachBox: t("inbox.attachBox", "Koppla låda"),
        imageRolesAndOrder: t("inbox.imageRolesAndOrder", "Bildroller och ordning"),
        imageNumber: t("shared.imageNumber", "Bild {count}"),
        role: t("shared.role", "Roll"),
        moveUp: t("shared.moveUp", "Flytta upp"),
        moveDown: t("shared.moveDown", "Flytta ner"),
        likelyBoxes: t("inbox.likelyBoxes", "Sannolika befintliga lådor"),
        currentSummaryMissing: t("home.summaryMissing", "Ingen aktuell sammanfattning ännu."),
        attachExistingBox: t("inbox.attachExistingBox", "Koppla till befintlig låda"),
        createSessionFromSuggestion: t("inbox.createSessionFromSuggestion", "Skapa session från förslaget"),
        latestAlbumImages: t("inbox.latestAlbumImages", "Senaste bilderna i albumet"),
        showingOfCount: t("inbox.showingOfCount", "Visar {visible} av {total} bilder"),
        selected: t("shared.selected", "Vald"),
        select: t("shared.select", "Välj"),
        image: t("shared.image", "Bild"),
        openLargeImage: t("shared.openLargeImage", "Visa större bild: {name}"),
        showMoreImages: t("inbox.showMoreImages", "Visa fler bilder"),
        empty: t("inbox.empty", "Inboxen är tom just nu. Alla bilder i albumet är redan kopplade eller så väntar vi på nästa import från mobilen."),
        closeImageView: t("shared.closeImageView", "Stäng bildvisning")
      }}
    />
  );
}
