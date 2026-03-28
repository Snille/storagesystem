import { NextResponse } from "next/server";
import { fetchAvailableAlbums } from "@/lib/immich-albums";
import type { ImmichAccessMode, PhotoSourceProvider } from "@/lib/types";

function asAccessMode(value: string): ImmichAccessMode {
  return value === "shareKey" ? "shareKey" : "apiKey";
}

function asProvider(value: string): PhotoSourceProvider {
  return value === "photoprism" || value === "nextcloud" ? value : "immich";
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as {
      baseUrl?: string;
      accessMode?: string;
      apiKey?: string;
      shareKey?: string;
      currentAlbumId?: string;
      provider?: string;
    };

    const provider = asProvider(String(payload.provider ?? "immich"));
    const accessMode = provider === "photoprism" ? "apiKey" : asAccessMode(String(payload.accessMode ?? "apiKey"));

    const albums = await fetchAvailableAlbums({
      baseUrl: String(payload.baseUrl ?? "").trim(),
      accessMode,
      apiKey: String(payload.apiKey ?? "").trim(),
      shareKey: String(payload.shareKey ?? "").trim(),
      currentAlbumId: String(payload.currentAlbumId ?? "").trim(),
      provider
    });

    return NextResponse.json({ albums });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Kunde inte hämta albumlistan." },
      { status: 500 }
    );
  }
}
