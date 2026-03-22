import { NextResponse } from "next/server";
import { analyzeSinglePhoto } from "@/lib/analysis";
import { updatePhotoNotes } from "@/lib/data-store";
import {
  completePhotoAnalysisJob,
  createPhotoAnalysisJob,
  failAnalysisJob,
  getAnalysisJob,
  updateAnalysisJob
} from "@/lib/analysis-jobs";

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as { photoId?: string; assetId?: string; clear?: boolean };
    const photoId = String(payload.photoId ?? "").trim();
    const assetId = String(payload.assetId ?? "").trim();
    const clear = Boolean(payload.clear);

    if ((!photoId && clear) || (!assetId && !clear)) {
      return NextResponse.json({ error: clear ? "photoId måste anges för rensning." : "assetId måste anges." }, { status: 400 });
    }

    if (clear) {
      await updatePhotoNotes({ photoId, notes: "" });
      return NextResponse.json({ summary: "" });
    }

    const job = createPhotoAnalysisJob("Köar bildanalys...");
    void (async () => {
      try {
        updateAnalysisJob(job.jobId, { phase: "running", message: "Startar bildanalys..." });
        const summary = await analyzeSinglePhoto(assetId, async (message) => {
          updateAnalysisJob(job.jobId, { phase: "running", message });
        });
        if (photoId) {
          await updatePhotoNotes({ photoId, notes: summary });
        }
        completePhotoAnalysisJob(job.jobId, summary);
      } catch (error) {
        failAnalysisJob(
          job.jobId,
          error instanceof Error ? error.message : "Bildanalysen misslyckades."
        );
      }
    })();

    return NextResponse.json({ jobId: job.jobId });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Bildanalysen misslyckades."
      },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const jobId = searchParams.get("jobId")?.trim() ?? "";

  if (!jobId) {
    return NextResponse.json({ error: "jobId måste anges." }, { status: 400 });
  }

  const job = getAnalysisJob(jobId);
  if (!job || job.kind !== "photo") {
    return NextResponse.json({ error: "Bildanalysjobbet kunde inte hittas." }, { status: 404 });
  }

  return NextResponse.json(job);
}
