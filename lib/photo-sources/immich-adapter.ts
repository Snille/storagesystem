import type { AvailableAlbum, ImmichAsset, PhotoSourceSettings } from "@/lib/types";
import type { PhotoSourceAdapter, PhotoSourceAlbum } from "@/lib/photo-source";

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, "");

function apiKeyHeaders(config: Pick<PhotoSourceSettings, "apiKey">) {
  if (!config.apiKey) {
    throw new Error("IMMICH_API_KEY must be configured.");
  }

  return { "x-api-key": config.apiKey } as Record<string, string>;
}

async function request<T>(url: string, headers: Record<string, string>): Promise<T> {
  const response = await fetch(url, {
    headers,
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`Immich request failed: ${response.status} ${response.statusText}`);
  }

  return response.json() as Promise<T>;
}

async function fetchAlbumAssetsByApiKey(config: PhotoSourceSettings): Promise<ImmichAsset[]> {
  const headers = { ...apiKeyHeaders(config), "content-type": "application/json" };
  const assets: ImmichAsset[] = [];
  let page: string | undefined;

  do {
    const response = await fetch(`${config.baseUrl}/api/search/metadata`, {
      method: "POST",
      headers,
      cache: "no-store",
      body: JSON.stringify({ albumIds: [config.albumId], size: 1000, page: page ?? 1 })
    });

    if (!response.ok) {
      throw new Error(`Immich request failed: ${response.status} ${response.statusText}`);
    }

    const json = (await response.json()) as {
      assets: { items: ImmichAsset[]; nextPage: string | null };
    };

    assets.push(...json.assets.items);
    page = json.assets.nextPage ?? undefined;
  } while (page);

  return assets;
}

async function fetchImmichAlbumDetails(config: PhotoSourceSettings): Promise<PhotoSourceAlbum> {
  if (!config.albumId) {
    throw new Error("IMMICH_ALBUM_ID saknas.");
  }

  if (config.accessMode === "apiKey") {
    const album = await request<{
      id: string;
      albumName?: string;
      albumThumbnailAssetId?: string;
    }>(`${config.baseUrl}/api/albums/${config.albumId}`, apiKeyHeaders(config));

    const assets = await fetchAlbumAssetsByApiKey(config);

    return {
      id: album.id,
      albumName: album.albumName,
      albumThumbnailAssetId: album.albumThumbnailAssetId,
      assets: assets.sort((a, b) => a.fileCreatedAt.localeCompare(b.fileCreatedAt))
    };
  }

  if (!config.shareKey) {
    throw new Error("IMMICH_SHARE_KEY must be configured.");
  }

  const sharedLink = await request<{
    album?: { id: string; albumName?: string; albumThumbnailAssetId?: string };
    assets: ImmichAsset[];
  }>(`${config.baseUrl}/api/shared-links/me?key=${config.shareKey}`, {});

  return {
    id: sharedLink.album?.id ?? config.albumId,
    albumName: sharedLink.album?.albumName,
    albumThumbnailAssetId: sharedLink.album?.albumThumbnailAssetId,
    assets: [...sharedLink.assets].sort((a, b) => a.fileCreatedAt.localeCompare(b.fileCreatedAt))
  };
}

type AlbumListEntry = {
  id?: string;
  albumName?: string;
  assetCount?: number;
  albumUsers?: Array<{ user?: { name?: string } }>;
  shared?: boolean;
};

function toAvailableAlbum(album: AlbumListEntry): AvailableAlbum {
  return {
    id: album.id ?? "",
    label: album.albumName ?? album.id ?? "",
    assetCount: album.assetCount ?? 0,
    ownerName: album.albumUsers?.[0]?.user?.name,
    shared: album.shared
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

  if (input.accessMode === "shareKey") {
    if (!input.shareKey) {
      return [];
    }

    const response = await fetch(`${baseUrl}/api/shared-links/me?key=${input.shareKey}`, {
      cache: "no-store"
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Kunde inte hämta album: ${response.status} ${text}`);
    }

    const json = (await response.json()) as { album?: AlbumListEntry };
    return json.album?.id ? [toAvailableAlbum(json.album)] : [];
  }

  const headers = input.apiKey ? { "x-api-key": input.apiKey } : undefined;

  const response = await fetch(`${baseUrl}/api/albums`, {
    headers,
    cache: "no-store"
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Kunde inte hämta album: ${response.status} ${text}`);
  }

  const json = (await response.json()) as AlbumListEntry[];
  const albums = (json ?? []).map(toAvailableAlbum).filter((album) => album.id);

  const hasCurrent = !!input.currentAlbumId && albums.some((album) => album.id === input.currentAlbumId);
  if (!input.currentAlbumId || hasCurrent) {
    return albums;
  }

  const currentResponse = await fetch(`${baseUrl}/api/albums/${input.currentAlbumId}`, {
    headers,
    cache: "no-store"
  });

  if (!currentResponse.ok) {
    return albums;
  }

  const current = (await currentResponse.json()) as AlbumListEntry;
  if (!current.id) {
    return albums;
  }

  return [toAvailableAlbum(current), ...albums];
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
      query.set("size", "thumbnail");
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
