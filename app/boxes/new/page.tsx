import { saveBoxSession } from "@/app/boxes/new/actions";
import { SessionForm } from "@/app/boxes/new/session-form";
import { getCurrentSessionByBox, readInventoryData } from "@/lib/data-store";
import { fetchAlbumDetails, getAssetOriginalUrl, getAssetThumbnailUrl } from "@/lib/immich";
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
  const [album, data] = await Promise.all([
    fetchAlbumDetails().catch(() => ({ id: "", assets: [], albumThumbnailAssetId: "", albumName: "" })),
    readInventoryData()
  ]);
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
        <h1>Ny låda eller ny inventeringssession</h1>
        {params.summary ? (
          <div className="callout">
            Analysförslag inläst. Gå igenom fälten, justera det som behövs och spara sedan
            sessionen.
          </div>
        ) : null}
        {params.duplicateWarning ? (
          <div className="callout">
            {params.duplicateWarning}
          </div>
        ) : null}
      </section>

      <section className="panel">
        <h2>Registrera eller uppdatera</h2>
        <form action={saveBoxSession}>
          <SessionForm
            defaults={{
              boxId: params.boxId ?? "",
              label: params.label ?? "",
              currentLocationId: params.currentLocationId ?? "",
              sessionId: params.sessionId ?? "",
              createdAt: params.createdAt ?? "",
              summary: params.summary ?? "",
              itemKeywords: params.itemKeywords ?? "",
              notes: params.notes ?? "",
              duplicateWarning: params.duplicateWarning ?? ""
            }}
            initialPhotos={initialPhotos}
            availablePhotos={availablePhotos}
            existingBoxes={data.boxes.map((box) => ({
              boxId: box.boxId,
              label: box.label,
              currentLocationId: box.currentLocationId
            }))}
          />
        </form>
      </section>
    </div>
  );
}
