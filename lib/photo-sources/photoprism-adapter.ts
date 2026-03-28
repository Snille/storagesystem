import path from "node:path";
import type { AvailableAlbum, ImmichAsset, PhotoSourceSettings } from "@/lib/types";
import type { PhotoSourceAdapter, PhotoSourceAlbum } from "@/lib/photo-source";

type PhotoPrismAlbumRecord = {
  UID?: string;
  Title?: string;
  Thumb?: string;
  PhotoCount?: number;
};

type PhotoPrismSearchPhoto = {
  UID?: string;
  Type?: string;
  FileName?: string;
  OriginalName?: string;
  TakenAt?: string;
  TakenAtLocal?: string;
  Hash?: string;
  Width?: number;
  Height?: number;
  Files?: Array<{
    Hash?: string;
    Mime?: string;
    Name?: string;
    Primary?: boolean;
    Width?: number;
    Height?: number;
  }>;
};

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, "");

function createHeaders(config: Pick<PhotoSourceSettings, "apiKey">): Record<string, string> {
  if (!config.apiKey) {
    throw new Error("A PhotoPrism app password or access token is required.");
  }

  return {
    Authorization: `Bearer ${config.apiKey}`
  };
}

async function requestJson<T>(url: string, config: Pick<PhotoSourceSettings, "apiKey">): Promise<{
  json: T;
  response: Response;
}> {
  const response = await fetch(url, {
    headers: createHeaders(config),
    cache: "no-store"
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`PhotoPrism request failed: ${response.status} ${text}`);
  }

  return {
    json: (await response.json()) as T,
    response
  };
}

function buildSearchPhotosUrl(baseUrl: string, query: Record<string, string | number | boolean>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    search.set(key, String(value));
  }
  return `${trimTrailingSlash(baseUrl)}/api/v1/photos?${search.toString()}`;
}

function mapPhotoToAsset(
  photo: PhotoPrismSearchPhoto,
  previewToken = "",
  downloadToken = ""
): ImmichAsset {
  const primaryFile = photo.Files?.find((file) => file.Primary) ?? photo.Files?.[0];
  const fileName = primaryFile?.Name || photo.FileName || photo.OriginalName || photo.UID || "";
  const createdAt = photo.TakenAt || "";

  return {
    id: photo.UID ?? "",
    originalFileName: path.basename(fileName),
    type: photo.Type || "image",
    fileCreatedAt: createdAt,
    localDateTime: photo.TakenAtLocal || createdAt,
    originalMimeType: primaryFile?.Mime || "image/jpeg",
    width: photo.Width ?? primaryFile?.Width,
    height: photo.Height ?? primaryFile?.Height,
    previewToken,
    downloadToken,
    fileHash: primaryFile?.Hash || photo.Hash
  };
}

async function fetchPhotoPrismAvailableAlbums(input: {
  baseUrl: string;
  apiKey?: string;
}): Promise<AvailableAlbum[]> {
  const baseUrl = trimTrailingSlash(input.baseUrl);
  if (!baseUrl) {
    return [];
  }

  const { json } = await requestJson<PhotoPrismAlbumRecord[]>(
    `${baseUrl}/api/v1/albums?count=1000&offset=0&order=title`,
    { apiKey: input.apiKey }
  );

  return (json ?? [])
    .map((album) => ({
      id: album.UID ?? "",
      label: album.Title ?? album.UID ?? "",
      assetCount: album.PhotoCount ?? 0
    }))
    .filter((album) => album.id);
}

async function fetchPhotoPrismAlbumDetails(config: PhotoSourceSettings): Promise<PhotoSourceAlbum> {
  if (!config.albumId) {
    throw new Error("A PhotoPrism album ID is required.");
  }

  const baseUrl = trimTrailingSlash(config.baseUrl);
  const [{ json: album }, { json: photos, response }] = await Promise.all([
    requestJson<PhotoPrismAlbumRecord>(`${baseUrl}/api/v1/albums/${config.albumId}`, { apiKey: config.apiKey }),
    requestJson<PhotoPrismSearchPhoto[]>(
      buildSearchPhotosUrl(baseUrl, {
        s: config.albumId,
        count: 100000,
        offset: 0,
        order: "oldest",
        merged: true,
        q: "primary:true"
      }),
      { apiKey: config.apiKey }
    )
  ]);

  const previewToken = response.headers.get("X-Preview-Token") ?? "";
  const downloadToken = response.headers.get("X-Download-Token") ?? "";
  const assets = (photos ?? [])
    .map((photo) => mapPhotoToAsset(photo, previewToken, downloadToken))
    .filter((asset) => asset.id);
  const albumThumbnailAssetId = assets.find((asset) => asset.fileHash === album.Thumb)?.id || assets[0]?.id || "";

  return {
    id: album.UID ?? config.albumId,
    albumName: album.Title ?? config.albumId,
    albumThumbnailAssetId,
    assets
  };
}

async function resolvePhotoPrismAsset(config: PhotoSourceSettings, assetId: string) {
  const baseUrl = trimTrailingSlash(config.baseUrl);
  const { json, response } = await requestJson<PhotoPrismSearchPhoto[]>(
    buildSearchPhotosUrl(baseUrl, {
      count: 1,
      offset: 0,
      merged: true,
      q: `uid:${assetId} primary:true`
    }),
    { apiKey: config.apiKey }
  );

  const photo = json?.[0];
  if (!photo?.UID) {
    throw new Error(`PhotoPrism asset '${assetId}' was not found.`);
  }

  const primaryFile = photo.Files?.find((file) => file.Primary) ?? photo.Files?.[0];
  return {
    photoUid: photo.UID,
    fileHash: primaryFile?.Hash || photo.Hash || "",
    previewToken: response.headers.get("X-Preview-Token") ?? "",
    downloadToken: response.headers.get("X-Download-Token") ?? ""
  };
}

export function createPhotoPrismPhotoSourceAdapter(): PhotoSourceAdapter {
  return {
    provider: "photoprism",
    async fetchAlbumDetails(config) {
      return fetchPhotoPrismAlbumDetails(config);
    },
    async fetchAvailableAlbums(input) {
      return fetchPhotoPrismAvailableAlbums(input);
    },
    buildAssetThumbnailUrl(assetId) {
      return `/api/immich/assets/${assetId}/thumbnail`;
    },
    buildAssetOriginalUrl(assetId) {
      return `/api/immich/assets/${assetId}/original`;
    },
    async fetchAssetThumbnailResponse(config, assetId) {
      const baseUrl = trimTrailingSlash(config.baseUrl);
      const resolved = await resolvePhotoPrismAsset(config, assetId);
      if (!resolved.fileHash || !resolved.previewToken) {
        return new Response(null, { status: 404 });
      }

      return fetch(`${baseUrl}/api/v1/t/${resolved.fileHash}/${resolved.previewToken}/tile_500`, {
        headers: createHeaders({ apiKey: config.apiKey }),
        cache: "force-cache"
      });
    },
    async fetchAssetOriginalResponse(config, assetId) {
      const baseUrl = trimTrailingSlash(config.baseUrl);
      const resolved = await resolvePhotoPrismAsset(config, assetId);

      return fetch(`${baseUrl}/api/v1/photos/${resolved.photoUid}/dl`, {
        headers: createHeaders({ apiKey: config.apiKey }),
        cache: "no-store"
      });
    }
  };
}
