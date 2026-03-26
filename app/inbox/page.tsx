import { getCurrentSessionByBox, readInventoryData } from "@/lib/data-store";
import { getUnmappedInboxAssets } from "@/lib/album-assets";
import { fetchAlbumDetails, getAssetOriginalUrl, getAssetThumbnailUrl } from "@/lib/immich";
import { InboxWorkspace } from "@/app/inbox/inbox-workspace";

export default async function InboxPage() {
  const [album, data] = await Promise.all([fetchAlbumDetails(), readInventoryData()]);
  const currentSessionIds = new Set([...getCurrentSessionByBox(data).values()].map((session) => session.sessionId));
  const mappedAssetIds = new Set(
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
    />
  );
}
