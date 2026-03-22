import { NextResponse } from "next/server";
import { fetchAvailableAlbums } from "@/lib/immich-albums";
import type { ImmichAccessMode } from "@/lib/types";

function asAccessMode(value: string): ImmichAccessMode {
  return value === "shareKey" ? "shareKey" : "apiKey";
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as {
      baseUrl?: string;
      accessMode?: string;
      apiKey?: string;
      shareKey?: string;
      currentAlbumId?: string;
    };

    const albums = await fetchAvailableAlbums({
      baseUrl: String(payload.baseUrl ?? "").trim(),
      accessMode: asAccessMode(String(payload.accessMode ?? "apiKey")),
      apiKey: String(payload.apiKey ?? "").trim(),
      shareKey: String(payload.shareKey ?? "").trim(),
      currentAlbumId: String(payload.currentAlbumId ?? "").trim()
    });

    return NextResponse.json({ albums });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Kunde inte hämta albumlistan." },
      { status: 500 }
    );
  }
}

