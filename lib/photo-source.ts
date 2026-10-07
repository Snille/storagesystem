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

const ALBUM_ASSETS_CACHE_MS = 5 * 60_000;
let albumAssetsCache: { configKey: string; expiresAt: number; assets: Promise<ImmichAsset[]> } | null = null;

function getAlbumConfigKey() {
  return JSON.stringify(getPhotoSourceConfig());
}

/** Always asks the photo source. Use it where new photos must show up at once (inbox, analysis). */
export async function fetchAlbumAssets(): Promise<ImmichAsset[]> {
  const configKey = getAlbumConfigKey();
  const album = await fetchAlbumDetails();
  const assets = getNonCoverAlbumAssets(album).sort((a, b) => a.fileCreatedAt.localeCompare(b.fileCreatedAt));
  albumAssetsCache = { configKey, expiresAt: Date.now() + ALBUM_ASSETS_CACHE_MS, assets: Promise.resolve(assets) };
  return structuredClone(assets);
}

/**
 * Reuses an album listing up to a few minutes old. For lookups such as search, where
 * a full paginated album fetch on every request costs far more than a slightly stale list.
 */
export async function fetchAlbumAssetsCached(): Promise<ImmichAsset[]> {
  const configKey = getAlbumConfigKey();
  let entry = albumAssetsCache;

  if (!entry || entry.configKey !== configKey || entry.expiresAt <= Date.now()) {
    const assets = fetchAlbumAssets();
    const pending = { configKey, expiresAt: Date.now() + ALBUM_ASSETS_CACHE_MS, assets };
    entry = pending;
    albumAssetsCache = pending;
    assets.catch(() => {
      if (albumAssetsCache === pending) {
        albumAssetsCache = null;
      }
    });
  }

  return structuredClone(await entry.assets);
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
