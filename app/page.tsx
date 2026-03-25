import { HomeSearchForm } from "@/app/home-search-form";
import { HomeBoxCard } from "@/app/home-box-card";
import { getCurrentSessionByBox, readInventoryData } from "@/lib/data-store";
import { fetchAlbumAssets, getAssetOriginalUrl, getAssetThumbnailUrl } from "@/lib/immich";
import { presentLocation } from "@/lib/location-presentation";
import { compareBoxesByLocation } from "@/lib/location-sort";
import { searchInventory } from "@/lib/search";
import packageJson from "@/package.json";

type HomeProps = {
  searchParams: Promise<{ q?: string }>;
};

export default async function Home({ searchParams }: HomeProps) {
  const params = await searchParams;
  const query = params.q?.trim() ?? "";
  const [data, albumAssets] = await Promise.all([
    readInventoryData(),
    query ? fetchAlbumAssets().catch(() => []) : Promise.resolve([])
  ]);
  const sessionsByBox = getCurrentSessionByBox(data);
  const currentSessions = [...sessionsByBox.values()];
  const currentLocationCount = new Set(
    data.boxes.map((box) => box.currentLocationId.trim()).filter(Boolean)
  ).size;
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
  const sortedBoxes = [...data.boxes].sort(compareBoxesByLocation);

  return (
    <div className="shell">
      <section className="panel">
        <div className="section-header">
          <h2>Sök efter något i verkstan</h2>
          <span className="app-version-badge" aria-label={`Appversion ${packageJson.version}`}>
            v{packageJson.version}
          </span>
        </div>
        <HomeSearchForm query={query} />
        {query ? (
          <div className="card-list" style={{ marginTop: 18 }}>
            {results.length > 0 ? (
              results.map((result) => {
                const boxMeta = presentLocation(result.box.currentLocationId, result.box.boxId);
                return (
                  <HomeBoxCard
                    key={result.box.boxId}
                    href={`/boxes/${result.box.boxId}`}
                    label={result.box.label}
                    summary={result.session?.summary ?? "Ingen aktuell sammanfattning ännu."}
                    keywords={result.session?.itemKeywords ?? []}
                    photoCount={result.photos.length}
                    location={boxMeta}
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
              <div className="empty">Ingen träff ännu. Lägg till eller uppdatera en session.</div>
            )}
          </div>
        ) : null}
      </section>

      <section className="hero">
        <h1>Verkstadsinventarie med Immich som bildlager</h1>
        <div className="grid three">
          <div className="stat">
            <strong>{data.boxes.length}</strong>
            registrerade lådor
          </div>
          <div className="stat">
            <strong>{currentLocationCount}</strong>
            aktuella platser
          </div>
          <div className="stat">
            <strong>{data.photos.length}</strong>
            kopplade bilder
          </div>
        </div>
      </section>

      <section className="panel">
        <h2>Aktuella lådor</h2>
        <div className="two-column-list">
          {sortedBoxes.map((box) => {
            const session = sessionsByBox.get(box.boxId);
            const photos = session ? photosBySession.get(session.sessionId) ?? [] : [];
            const boxMeta = presentLocation(box.currentLocationId, box.boxId);

            return (
              <HomeBoxCard
                key={box.boxId}
                href={`/boxes/${box.boxId}`}
                label={box.label}
                summary={session?.summary ?? "Ingen aktiv session ännu."}
                keywords={session?.itemKeywords ?? []}
                photoCount={photos.length}
                location={boxMeta}
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
