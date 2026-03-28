import type { AvailableAlbum, ImmichAsset, PhotoSourceSettings } from "@/lib/types";
import type { PhotoSourceAdapter, PhotoSourceAlbum } from "@/lib/photo-source";

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, "");

function createHeaders(config: Pick<PhotoSourceSettings, "accessMode" | "apiKey" | "shareKey">) {
  if (config.accessMode === "apiKey" && config.apiKey) {
    return { "x-api-key": config.apiKey } as Record<string, string>;
  }

  if (config.accessMode === "shareKey" && config.shareKey) {
    return { "x-share-key": config.shareKey } as Record<string, string>;
  }

  throw new Error("IMMICH_API_KEY or IMMICH_SHARE_KEY must be configured.");
}

async function request<T>(url: string, config: Pick<PhotoSourceSettings, "accessMode" | "apiKey" | "shareKey">): Promise<T> {
  const response = await fetch(url, {
    headers: createHeaders(config),
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`Immich request failed: ${response.status} ${response.statusText}`);
  }

  return response.json() as Promise<T>;
}

async function fetchImmichAlbumDetails(config: PhotoSourceSettings): Promise<PhotoSourceAlbum> {
  if (!config.albumId) {
    throw new Error("IMMICH_ALBUM_ID saknas.");
  }

  const query = config.accessMode === "apiKey" ? "" : `?key=${config.shareKey ?? ""}`;
  const album = await request<{
    id: string;
    albumName?: string;
    albumThumbnailAssetId?: string;
    assets: ImmichAsset[];
  }>(`${config.baseUrl}/api/albums/${config.albumId}${query}`, config);

  return {
    id: album.id,
    albumName: album.albumName,
    albumThumbnailAssetId: album.albumThumbnailAssetId,
    assets: [...album.assets].sort((a, b) => a.fileCreatedAt.localeCompare(b.fileCreatedAt))
  };
}

async function fetchImmichAvailableAlbums(input: {
  baseUrl: string;
  accessMode: PhotoSourceSettings["accessMode"];
  apiKey?: string;
  shareKey?: string;
  currentAlbumId?: string;
}): Promise<AvailableAlbum[]> {
  const baseUrl = trimTrailingSlash(input.baseUrl);
  if (!baseUrl) {
    return [];
  }

  const query = input.accessMode === "shareKey" && input.shareKey ? `?key=${input.shareKey}` : "";
  const headers = input.accessMode === "apiKey" && input.apiKey ? { "x-api-key": input.apiKey } : undefined;

  const response = await fetch(`${baseUrl}/api/albums${query}`, {
    headers,
    cache: "no-store"
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Kunde inte hämta album: ${response.status} ${text}`);
  }

  const json = (await response.json()) as Array<{
    id?: string;
    albumName?: string;
    assetCount?: number;
    owner?: { name?: string };
    shared?: boolean;
  }>;

  const albums = (json ?? [])
    .map((album) => ({
      id: album.id ?? "",
      label: album.albumName ?? album.id ?? "",
      assetCount: album.assetCount ?? 0,
      ownerName: album.owner?.name,
      shared: album.shared
    }))
    .filter((album) => album.id);

  const hasCurrent = !!input.currentAlbumId && albums.some((album) => album.id === input.currentAlbumId);
  if (!input.currentAlbumId || hasCurrent) {
    return albums;
  }

  const currentResponse = await fetch(`${baseUrl}/api/albums/${input.currentAlbumId}${query}`, {
    headers,
    cache: "no-store"
  });

  if (!currentResponse.ok) {
    return albums;
  }

  const current = (await currentResponse.json()) as {
    id?: string;
    albumName?: string;
    assetCount?: number;
    owner?: { name?: string };
    shared?: boolean;
  };

  if (!current.id) {
    return albums;
  }

  return [
    {
      id: current.id,
      label: current.albumName ?? current.id,
      assetCount: current.assetCount ?? 0,
      ownerName: current.owner?.name,
      shared: current.shared
    },
    ...albums
  ];
}

export function createImmichPhotoSourceAdapter(): PhotoSourceAdapter {
  return {
    provider: "immich",
    async fetchAlbumDetails(config) {
      return fetchImmichAlbumDetails(config);
    },
    async fetchAvailableAlbums(input) {
      return fetchImmichAvailableAlbums(input);
    },
    buildAssetThumbnailUrl(assetId) {
      return `/api/immich/assets/${assetId}/thumbnail`;
    },
    buildAssetOriginalUrl(assetId) {
      return `/api/immich/assets/${assetId}/original`;
    },
    async fetchAssetThumbnailResponse(config, assetId) {
      const query = new URLSearchParams();
      query.set("format", "WEBP");
      if (config.accessMode !== "apiKey" && config.shareKey) {
        query.set("key", config.shareKey);
      }

      return fetch(`${config.baseUrl}/api/assets/${assetId}/thumbnail?${query.toString()}`, {
        headers: config.accessMode === "apiKey" && config.apiKey ? { "x-api-key": config.apiKey } : undefined,
        cache: "force-cache"
      });
    },
    async fetchAssetOriginalResponse(config, assetId) {
      const query = new URLSearchParams();
      query.set("edited", "true");
      if (config.accessMode !== "apiKey" && config.shareKey) {
        query.set("key", config.shareKey);
      }

      return fetch(`${config.baseUrl}/api/assets/${assetId}/original?${query.toString()}`, {
        headers: config.accessMode === "apiKey" && config.apiKey ? { "x-api-key": config.apiKey } : undefined,
        cache: "no-store"
      });
    }
  };
}
