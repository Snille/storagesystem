import { NextResponse } from "next/server";
import { removePhotoFromSession } from "@/lib/data-store";

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as { photoId?: string };
    const photoId = String(payload.photoId ?? "").trim();

    if (!photoId) {
      return NextResponse.json({ error: "photoId måste anges." }, { status: 400 });
    }

    await removePhotoFromSession(photoId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Kunde inte släppa bilden."
      },
      { status: 500 }
    );
  }
}
