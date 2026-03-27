import { NextResponse } from "next/server";
import { analyzeSelectedAssets } from "@/lib/analysis";
import {
  completeSelectionAnalysisJob,
  createSelectionAnalysisJob,
  failAnalysisJob,
  getAnalysisJob,
  updateAnalysisJob
} from "@/lib/analysis-jobs";

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as { assetIds?: string[] };
    const assetIds = (payload.assetIds ?? []).filter(Boolean);

    if (assetIds.length === 0) {
      return NextResponse.json({ error: "Minst en bild måste väljas." }, { status: 400 });
    }

    const job = createSelectionAnalysisJob("Köar analys...");
    void (async () => {
      try {
        updateAnalysisJob(job.jobId, { phase: "running", message: "Startar analys..." });
        const suggestion = await analyzeSelectedAssets(assetIds, async (message) => {
          updateAnalysisJob(job.jobId, { phase: "running", message });
        });
        completeSelectionAnalysisJob(job.jobId, suggestion);
      } catch (error) {
        failAnalysisJob(
          job.jobId,
          error instanceof Error ? error.message : "Analysis failed."
        );
      }
    })();

    return NextResponse.json({ jobId: job.jobId });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Analysis failed."
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
  if (!job || job.kind !== "selection") {
    return NextResponse.json({ error: "Analysjobbet kunde inte hittas." }, { status: 404 });
  }

  return NextResponse.json(job);
}
