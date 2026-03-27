import { getImmichConfig } from "@/lib/config";
import type { ImmichAsset } from "@/lib/types";

function createHeaders(): Record<string, string> {
  const config = getImmichConfig();

  if (config.apiKey) {
    return { "x-api-key": config.apiKey };
  }

  if (config.shareKey) {
    return { "x-share-key": config.shareKey };
  }

  throw new Error("IMMICH_API_KEY or IMMICH_SHARE_KEY must be configured.");
}

async function request<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    headers: createHeaders(),
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`Immich request failed: ${response.status} ${response.statusText}`);
  }

  return response.json() as Promise<T>;
}

export async function fetchAlbumAssets(): Promise<ImmichAsset[]> {
  const album = await fetchAlbumDetails();
  return [...album.assets].sort((a, b) => a.fileCreatedAt.localeCompare(b.fileCreatedAt));
}

export async function fetchAlbumDetails(): Promise<{
  id: string;
  albumName?: string;
  albumThumbnailAssetId?: string;
  assets: ImmichAsset[];
}> {
  const config = getImmichConfig();

  if (!config.albumId) {
    throw new Error("IMMICH_ALBUM_ID saknas.");
  }

  const query = config.apiKey ? "" : `?key=${config.shareKey ?? ""}`;
  const album = await request<{
    id: string;
    albumName?: string;
    albumThumbnailAssetId?: string;
    assets: ImmichAsset[];
  }>(
    `${config.baseUrl}/api/albums/${config.albumId}${query}`
  );

  return {
    id: album.id,
    albumName: album.albumName,
    albumThumbnailAssetId: album.albumThumbnailAssetId,
    assets: [...album.assets].sort((a, b) => a.fileCreatedAt.localeCompare(b.fileCreatedAt))
  };
}

export function getAssetThumbnailUrl(assetId: string) {
  return `/api/immich/assets/${assetId}/thumbnail`;
}

export function getAssetOriginalUrl(assetId: string) {
  return `/api/immich/assets/${assetId}/original`;
}
