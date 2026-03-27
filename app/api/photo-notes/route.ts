import { NextResponse } from "next/server";
import { updatePhotoNotes } from "@/lib/data-store";

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as { photoId?: string; notes?: string };
    const photoId = String(payload.photoId ?? "").trim();
    const notes = String(payload.notes ?? "");

    if (!photoId) {
      return NextResponse.json({ error: "photoId is required." }, { status: 400 });
    }

    await updatePhotoNotes({ photoId, notes });
    return NextResponse.json({ ok: true, notes });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Could not save the analysis text."
      },
      { status: 500 }
    );
  }
}
