import type { AvailableAlbum, ImmichAccessMode } from "@/lib/types";

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, "");

function buildHeaders(accessMode: ImmichAccessMode, apiKey?: string) {
  if (accessMode === "apiKey" && apiKey) {
    return { "x-api-key": apiKey };
  }

  return undefined;
}

export async function fetchAvailableAlbums(input: {
  baseUrl: string;
  accessMode: ImmichAccessMode;
  apiKey?: string;
  shareKey?: string;
  currentAlbumId?: string;
}): Promise<AvailableAlbum[]> {
  const baseUrl = trimTrailingSlash(input.baseUrl);
  if (!baseUrl) {
    return [];
  }

  const query = input.accessMode === "shareKey" && input.shareKey ? `?key=${input.shareKey}` : "";
  const headers = buildHeaders(input.accessMode, input.apiKey);

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
