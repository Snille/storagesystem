import { HomeSearchAnswer } from "@/app/home-search-answer";
import { HomeSearchForm } from "@/app/home-search-form";
import { HomeBoxCard } from "@/app/home-box-card";
import { ImageLightboxButton } from "@/app/components/image-lightbox-button";
import { getCurrentSessionByBox, readInventoryData } from "@/lib/data-store";
import { createTranslator, readLanguageCatalog } from "@/lib/i18n";
import { fetchAlbumDetails, getAssetOriginalUrl, getAssetThumbnailUrl } from "@/lib/immich";
import { presentLocation } from "@/lib/location-presentation";
import { parseBoxId, parseLocationId } from "@/lib/location-schema";
import { compareBoxesByLocation } from "@/lib/location-sort";
import { answerInventoryQuestion } from "@/lib/public-api";
import { searchInventory } from "@/lib/search";
import { readAppSettings } from "@/lib/settings";
import packageJson from "@/package.json";

type HomeProps = {
  searchParams: Promise<{ q?: string; mode?: string }>;
};

function buildSearchAnswer(
  query: string,
  results: ReturnType<typeof searchInventory>,
  t: ReturnType<typeof createTranslator>
) {
  if (!query) {
    return "";
  }

  if (results.length === 0) {
    return t("home.searchAnswerNone", 'Jag hittade ingen tydlig träff för "{query}".', { query });
  }

  if (results.length === 1) {
    const match = results[0];
    const location = presentLocation(match.box.currentLocationId, match.box.boxId, {
      shelvingUnit: t("boxForm.ivar", "Lagerhylla"),
      bench: t("boxForm.bench", "Bänk"),
      cabinet: t("boxForm.cabinet", "Skåp"),
      surface: t("boxForm.surface", "Yta"),
      slot: t("boxForm.place", "Plats")
    });

    return t("home.searchAnswerSingle", "{label} finns i {system}, {shelf}, {slot}.", {
      label: match.box.label,
      system: location.system,
      shelf: location.shelf,
      slot: location.slot
    });
  }

  const topMatch = results[0];
  const location = presentLocation(topMatch.box.currentLocationId, topMatch.box.boxId, {
    shelvingUnit: t("boxForm.ivar", "Lagerhylla"),
    bench: t("boxForm.bench", "Bänk"),
    cabinet: t("boxForm.cabinet", "Skåp"),
    surface: t("boxForm.surface", "Yta"),
    slot: t("boxForm.place", "Plats")
  });

  return t(
    "home.searchAnswerMultiple",
    'Jag hittade {count} träffar för "{query}". Den tydligaste verkar vara {label} i {system}, {shelf}, {slot}.',
    {
      count: results.length,
      query,
      label: topMatch.box.label,
      system: location.system,
      shelf: location.shelf,
      slot: location.slot
    }
  );
}

export default async function Home({ searchParams }: HomeProps) {
  const params = await searchParams;
  const query = params.q?.trim() ?? "";
  const searchMode = params.mode === "voice" ? "voice" : "text";
  const [data, album, settings] = await Promise.all([
    readInventoryData(),
    fetchAlbumDetails().catch(() => ({ id: "", assets: [], albumThumbnailAssetId: "", albumName: "" })),
    readAppSettings()
  ]);
  const languageCatalog = await readLanguageCatalog(settings.appearance.language);
  const t = createTranslator(languageCatalog);
  const albumAssets = query ? album.assets : [];
  const sessionsByBox = getCurrentSessionByBox(data);
  const photosBySession = new Map(
    data.photos.reduce<Array<[string, typeof data.photos]>>((groups, photo) => {
      const existing = groups.find(([sessionId]) => sessionId === photo.sessionId);
      if (existing) {
        existing[1].push(photo);
      } else {
        groups.push([photo.sessionId, [photo]]);
      }
      return groups;
    }, [])
  );
  const assetFileNamesById = new Map(albumAssets.map((asset) => [asset.id, asset.originalFileName]));
  const results = query ? searchInventory(data, query, assetFileNamesById) : [];
  const searchAnswer = buildSearchAnswer(query, results, t);
  const spokenAnswer =
    query && searchMode === "voice"
      ? (await answerInventoryQuestion(query, "voice").catch(() => ({ answer: searchAnswer }))).answer
      : searchAnswer;
  const sortedBoxes = [...data.boxes].sort(compareBoxesByLocation);
  const overviewAsset = album.albumThumbnailAssetId ? album.assets.find((asset) => asset.id === album.albumThumbnailAssetId) : null;
  const locationUnits = new Set<string>();
  const locationUnitsByKind = {
    ivar: new Set<string>(),
    bench: new Set<string>(),
    cabinet: new Set<string>()
  };

  for (const box of data.boxes) {
    const parsedLocation = parseLocationId(box.currentLocationId) ?? parseBoxId(box.boxId);
    if (!parsedLocation) {
      continue;
    }

    const unitKey = `${parsedLocation.kind}:${parsedLocation.unitId}`;
    locationUnits.add(unitKey);
    locationUnitsByKind[parsedLocation.kind].add(unitKey);
  }

  const boxesWithPhotosCount = data.boxes.filter((box) => {
    const session = sessionsByBox.get(box.boxId);
    return Boolean(session && (photosBySession.get(session.sessionId)?.length ?? 0) > 0);
  }).length;
  const boxesWithoutPhotosCount = data.boxes.length - boxesWithPhotosCount;
  const stats = [
    {
      value: locationUnits.size,
      label: t("home.locationUnits", "platsenheter")
    },
    {
      value: locationUnitsByKind.ivar.size,
      label: t("home.ivarUnits", "IVAR-enheter")
    },
    {
      value: locationUnitsByKind.bench.size,
      label: t("home.benchUnits", "bänkenheter")
    },
    {
      value: locationUnitsByKind.cabinet.size,
      label: t("home.cabinetUnits", "skåpenheter")
    },
    {
      value: boxesWithPhotosCount,
      label: t("home.boxesWithPhotos", "lådor med bilder")
    },
    {
      value: boxesWithoutPhotosCount,
      label: t("home.boxesWithoutPhotos", "lådor utan kopplade bilder")
    }
  ];

  return (
    <div className="shell">
      <section className="panel">
        <div className="section-header">
          <h2>{t("home.searchTitle", "Sök efter något i verkstan")}</h2>
          <span className="app-version-badge" aria-label={t("home.versionAria", "Appversion {version}", { version: packageJson.version })}>
            v{packageJson.version}
          </span>
        </div>
        <HomeSearchForm
          query={query}
          speechRecognitionLocale={languageCatalog._meta.speechRecognitionLocale}
          ui={{
            label: t("search.label", "Fråga eller sökord"),
            placeholder: t("search.placeholder", "Till exempel: adaptrar, hålsåg, nätverkskabel"),
            voiceUnsupported: t("search.voiceUnsupported", "Röstsökning stöds inte i den här webbläsaren."),
            voiceCaptured: t("search.voiceCaptured", "Röst fångad. Du kan söka direkt."),
            voiceListening: t("search.voiceListening", "Lyssnar..."),
            voiceError: t("search.voiceError", "Det gick inte att läsa av rösten just nu."),
            voiceHint: t("search.voiceHint", "Tryck på Mikrofon och säg vad du letar efter."),
            startVoice: t("search.startVoice", "Starta röstsökning"),
            stopVoice: t("search.stopVoice", "Stoppa röstsökning"),
            microphone: t("search.microphone", "Mikrofon"),
            stop: t("search.stop", "Stoppa"),
            submit: t("search.submit", "Sök")
          }}
        />
        {query ? (
          <HomeSearchAnswer
            answer={spokenAnswer}
            locale={languageCatalog._meta.speechRecognitionLocale}
            autoSpeak={searchMode === "voice"}
            ui={{
              title: t("home.searchAnswerTitle", "Kort svar"),
              readAloud: t("home.readAnswer", "Läs upp svaret"),
              stopReading: t("home.stopReading", "Stoppa uppläsning"),
              speechUnsupported: t("home.speechUnsupported", "Talstödet saknas i den här webbläsaren.")
            }}
          />
        ) : null}
        {query ? (
          <div className="card-list" style={{ marginTop: 18 }}>
            {results.length > 0 ? (
              results.map((result) => {
                const boxMeta = presentLocation(result.box.currentLocationId, result.box.boxId, {
                  shelvingUnit: t("boxForm.ivar", "Lagerhylla"),
                  bench: t("boxForm.bench", "Bänk"),
                  cabinet: t("boxForm.cabinet", "Skåp"),
                  surface: t("boxForm.surface", "Yta"),
                  slot: t("boxForm.place", "Plats")
                });
                return (
                  <HomeBoxCard
                    key={result.box.boxId}
                    href={`/boxes/${result.box.boxId}`}
                    label={result.box.label}
                  summary={result.session?.summary ?? t("home.summaryMissing", "Ingen aktuell sammanfattning ännu.")}
                  keywords={result.session?.itemKeywords ?? []}
                  photoCount={result.photos.length}
                  location={boxMeta}
                  ui={{
                    openBox: t("home.openBox", "Öppna {label}"),
                    photosCount: t("home.photosCount", "Bilder {count}"),
                    openLargeImage: t("shared.openLargeImage", "Visa större bild: {name}"),
                    imageHasAnalysisText: t("shared.imageHasAnalysisText", "Bilden har analystext"),
                    closeImageView: t("shared.closeImageView", "Stäng bildvisning")
                  }}
                  photos={result.photos.map((photo) => ({
                      photoId: photo.photoId,
                      thumbnailUrl: getAssetThumbnailUrl(photo.immichAssetId),
                      originalUrl: getAssetOriginalUrl(photo.immichAssetId),
                      photoRole: photo.photoRole,
                      hasNotes: Boolean(photo.notes?.trim()),
                      notes: photo.notes
                    }))}
                  />
                );
              })
            ) : (
              <div className="empty">{t("home.noResults", "Ingen träff ännu. Lägg till eller uppdatera en session.")}</div>
            )}
          </div>
        ) : null}
      </section>

      {overviewAsset ? (
        <section className="panel overview-panel">
          <h2>{t("home.overviewImage", "Översiktsbild")}</h2>
          <div className="overview-card">
            <ImageLightboxButton
              alt={overviewAsset.originalFileName}
              buttonClassName="overview-image-button"
              imageClassName="overview-image"
              thumbnailUrl={getAssetThumbnailUrl(overviewAsset.id)}
              originalUrl={getAssetOriginalUrl(overviewAsset.id)}
              overlayTitle={album.albumName ? t("home.overviewOverlayTitle", "{albumName} - översikt", { albumName: album.albumName }) : t("home.overviewOverlayFallbackTitle", "Översiktsbild")}
              overlayMeta={new Date(overviewAsset.fileCreatedAt).toLocaleString("sv-SE")}
              overlayNote={t("home.overviewOverlayNote", "Albumomslag i Immich. Används som översiktsbild över miljön.")}
              ui={{
                openLargeImage: t("shared.openLargeImage", "Visa större bild: {name}"),
                imageHasAnalysisText: t("shared.imageHasAnalysisText", "Bilden har analystext"),
                closeImageView: t("shared.closeImageView", "Stäng bildvisning")
              }}
            />
          </div>
        </section>
      ) : null}

      <section className="hero">
        <h1 className="hero-subtitle">{t("home.heroTitle", "Lagerinventarie med Immich som bildlager")}</h1>
        <div className="home-stats-grid">
          {stats.map((stat) => (
            <div className="stat" key={stat.label}>
              <strong>{stat.value}</strong>
              {stat.label}
            </div>
          ))}
        </div>
      </section>

      <section className="panel">
        <h2>{t("home.currentBoxes", "Aktuella lådor")}</h2>
        <div className="two-column-list">
          {sortedBoxes.map((box) => {
            const session = sessionsByBox.get(box.boxId);
            const photos = session ? photosBySession.get(session.sessionId) ?? [] : [];
            const boxMeta = presentLocation(box.currentLocationId, box.boxId, {
              shelvingUnit: t("boxForm.ivar", "Lagerhylla"),
              bench: t("boxForm.bench", "Bänk"),
              cabinet: t("boxForm.cabinet", "Skåp"),
              surface: t("boxForm.surface", "Yta"),
              slot: t("boxForm.place", "Plats")
            });

            return (
              <HomeBoxCard
                key={box.boxId}
                href={`/boxes/${box.boxId}`}
                label={box.label}
                summary={session?.summary ?? t("home.activeSummaryMissing", "Ingen aktiv session ännu.")}
                keywords={session?.itemKeywords ?? []}
                photoCount={photos.length}
                location={boxMeta}
                ui={{
                  openBox: t("home.openBox", "Öppna {label}"),
                  photosCount: t("home.photosCount", "Bilder {count}"),
                  openLargeImage: t("shared.openLargeImage", "Visa större bild: {name}"),
                  imageHasAnalysisText: t("shared.imageHasAnalysisText", "Bilden har analystext"),
                  closeImageView: t("shared.closeImageView", "Stäng bildvisning")
                }}
                photos={photos.map((photo) => ({
                  photoId: photo.photoId,
                  thumbnailUrl: getAssetThumbnailUrl(photo.immichAssetId),
                  originalUrl: getAssetOriginalUrl(photo.immichAssetId),
                  photoRole: photo.photoRole,
                  hasNotes: Boolean(photo.notes?.trim()),
                  notes: photo.notes
                }))}
              />
            );
          })}
        </div>
      </section>
    </div>
  );
}
