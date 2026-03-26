import type { ImmichAsset } from "@/lib/types";

type AlbumWithAssets = {
  albumThumbnailAssetId?: string;
  assets: ImmichAsset[];
};

export function getNonCoverAlbumAssets(album: AlbumWithAssets): ImmichAsset[] {
  const coverAssetId = album.albumThumbnailAssetId?.trim() || "";
  return album.assets.filter((asset) => asset.id !== coverAssetId);
}

export function getUnmappedInboxAssets(album: AlbumWithAssets, mappedAssetIds: ReadonlySet<string>): ImmichAsset[] {
  return getNonCoverAlbumAssets(album).filter((asset) => !mappedAssetIds.has(asset.id));
}
