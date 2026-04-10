import { NextResponse } from "next/server";
import { analyzeSinglePhoto } from "@/lib/analysis";
import { readInventoryData, updatePhotoNotes } from "@/lib/data-store";
import {
  completePhotoAnalysisJob,
  createPhotoAnalysisJob,
  failAnalysisJob,
  getAnalysisJob,
  updateAnalysisJob
} from "@/lib/analysis-jobs";
import { readResolvedLanguageCode } from "@/lib/request-language";
import { readAppSettings } from "@/lib/settings";

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as { photoId?: string; assetId?: string; clear?: boolean };
    const photoId = String(payload.photoId ?? "").trim();
    const assetId = String(payload.assetId ?? "").trim();
    const clear = Boolean(payload.clear);

    if ((!photoId && clear) || (!assetId && !clear)) {
      return NextResponse.json({ error: clear ? "photoId is required when clearing notes." : "assetId is required." }, { status: 400 });
    }

    if (clear) {
      await updatePhotoNotes({ photoId, notes: "" });
      return NextResponse.json({ summary: "" });
    }

    const settings = await readAppSettings();
    const language = await readResolvedLanguageCode(settings.appearance.language ?? "en");
    const data = await readInventoryData();
    const photoRecord = photoId ? data.photos.find((p) => p.photoId === photoId) : undefined;
    const photoRole = photoRecord?.photoRole;

    const job = createPhotoAnalysisJob("Köar bildanalys...");
    void (async () => {
      try {
        updateAnalysisJob(job.jobId, { phase: "running", message: "Startar bildanalys..." });
        const summary = await analyzeSinglePhoto(assetId, async (message) => {
          updateAnalysisJob(job.jobId, { phase: "running", message });
        }, photoRole, language);
        if (photoId) {
          await updatePhotoNotes({ photoId, notes: summary });
        }
        completePhotoAnalysisJob(job.jobId, summary);
      } catch (error) {
        failAnalysisJob(
          job.jobId,
          error instanceof Error ? error.message : "Photo analysis failed."
        );
      }
    })();

    return NextResponse.json({ jobId: job.jobId });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Photo analysis failed."
      },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const jobId = searchParams.get("jobId")?.trim() ?? "";

  if (!jobId) {
    return NextResponse.json({ error: "jobId is required." }, { status: 400 });
  }

  const job = getAnalysisJob(jobId);
  if (!job || job.kind !== "photo") {
    return NextResponse.json({ error: "Bildanalysjobbet kunde inte hittas." }, { status: 404 });
  }

  return NextResponse.json(job);
}
