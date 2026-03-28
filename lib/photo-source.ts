import { getPhotoSourceConfig } from "@/lib/config";
import { getNonCoverAlbumAssets } from "@/lib/album-assets";
import { createImmichPhotoSourceAdapter } from "@/lib/photo-sources/immich-adapter";
import { createPhotoPrismPhotoSourceAdapter } from "@/lib/photo-sources/photoprism-adapter";
import type { AvailableAlbum, ImmichAsset, PhotoSourceProvider, PhotoSourceSettings } from "@/lib/types";

export type PhotoSourceAlbum = {
  id: string;
  albumName?: string;
  albumThumbnailAssetId?: string;
  assets: ImmichAsset[];
};

export type PhotoSourceAdapter = {
  provider: PhotoSourceProvider;
  fetchAlbumDetails(config: PhotoSourceSettings): Promise<PhotoSourceAlbum>;
  fetchAvailableAlbums(input: {
    baseUrl: string;
    accessMode: PhotoSourceSettings["accessMode"];
    apiKey?: string;
    shareKey?: string;
    currentAlbumId?: string;
  }): Promise<AvailableAlbum[]>;
  buildAssetThumbnailUrl(assetId: string): string;
  buildAssetOriginalUrl(assetId: string): string;
  fetchAssetThumbnailResponse(config: PhotoSourceSettings, assetId: string): Promise<Response>;
  fetchAssetOriginalResponse(config: PhotoSourceSettings, assetId: string): Promise<Response>;
};

function getPhotoSourceAdapter(provider: PhotoSourceProvider): PhotoSourceAdapter {
  if (provider === "immich") {
    return createImmichPhotoSourceAdapter();
  }

  if (provider === "photoprism") {
    return createPhotoPrismPhotoSourceAdapter();
  }

  throw new Error(`Photo source provider '${provider}' is not implemented yet.`);
}

export async function fetchAlbumDetails(): Promise<PhotoSourceAlbum> {
  const config = getPhotoSourceConfig();
  const adapter = getPhotoSourceAdapter(config.provider);
  return adapter.fetchAlbumDetails(config);
}

export async function fetchAlbumAssets(): Promise<ImmichAsset[]> {
  const album = await fetchAlbumDetails();
  return getNonCoverAlbumAssets(album).sort((a, b) => a.fileCreatedAt.localeCompare(b.fileCreatedAt));
}

export async function fetchAvailableAlbums(input: {
  baseUrl: string;
  accessMode: PhotoSourceSettings["accessMode"];
  apiKey?: string;
  shareKey?: string;
  currentAlbumId?: string;
  provider?: PhotoSourceProvider;
}): Promise<AvailableAlbum[]> {
  const provider = input.provider ?? "immich";
  const adapter = getPhotoSourceAdapter(provider);
  return adapter.fetchAvailableAlbums(input);
}

export function getAssetThumbnailUrl(assetId: string) {
  const config = getPhotoSourceConfig();
  return getPhotoSourceAdapter(config.provider).buildAssetThumbnailUrl(assetId);
}

export function getAssetOriginalUrl(assetId: string) {
  const config = getPhotoSourceConfig();
  return getPhotoSourceAdapter(config.provider).buildAssetOriginalUrl(assetId);
}

export async function fetchAssetThumbnailResponse(assetId: string) {
  const config = getPhotoSourceConfig();
  return getPhotoSourceAdapter(config.provider).fetchAssetThumbnailResponse(config, assetId);
}

export async function fetchAssetOriginalResponse(assetId: string) {
  const config = getPhotoSourceConfig();
  return getPhotoSourceAdapter(config.provider).fetchAssetOriginalResponse(config, assetId);
}
