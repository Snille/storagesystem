import { randomUUID } from "crypto";
import type { AnalysisSuggestion } from "@/lib/types";

type AnalysisJobKind = "selection" | "photo";
type AnalysisJobPhase = "queued" | "running" | "completed" | "failed";

type BaseJob = {
  jobId: string;
  kind: AnalysisJobKind;
  phase: AnalysisJobPhase;
  message: string;
  startedAt: string;
  updatedAt: string;
  error?: string;
};

type SelectionAnalysisJob = BaseJob & {
  kind: "selection";
  result?: AnalysisSuggestion;
};

type PhotoAnalysisJob = BaseJob & {
  kind: "photo";
  result?: { summary: string };
};

export type AnalysisJob = SelectionAnalysisJob | PhotoAnalysisJob;

const jobs = new Map<string, AnalysisJob>();
const JOB_TTL_MS = 30 * 60 * 1000;

function nowIso() {
  return new Date().toISOString();
}

function cleanupJobs() {
  const cutoff = Date.now() - JOB_TTL_MS;
  for (const [jobId, job] of jobs.entries()) {
    if (Date.parse(job.updatedAt) < cutoff) {
      jobs.delete(jobId);
    }
  }
}

function createJob(kind: AnalysisJobKind, message: string): AnalysisJob {
  cleanupJobs();
  const timestamp = nowIso();
  const job: AnalysisJob =
    kind === "selection"
      ? {
          jobId: randomUUID(),
          kind,
          phase: "queued",
          message,
          startedAt: timestamp,
          updatedAt: timestamp
        }
      : {
          jobId: randomUUID(),
          kind,
          phase: "queued",
          message,
          startedAt: timestamp,
          updatedAt: timestamp
        };
  jobs.set(job.jobId, job);
  return job;
}

export function createSelectionAnalysisJob(initialMessage = "Köar analys...") {
  return createJob("selection", initialMessage) as SelectionAnalysisJob;
}

export function createPhotoAnalysisJob(initialMessage = "Köar bildanalys...") {
  return createJob("photo", initialMessage) as PhotoAnalysisJob;
}

export function getAnalysisJob(jobId: string) {
  cleanupJobs();
  return jobs.get(jobId) ?? null;
}

export function updateAnalysisJob(jobId: string, patch: Partial<Omit<AnalysisJob, "jobId" | "kind" | "startedAt">>) {
  const current = jobs.get(jobId);
  if (!current) {
    return null;
  }

  const next: AnalysisJob = {
    ...current,
    ...patch,
    updatedAt: nowIso()
  } as AnalysisJob;
  jobs.set(jobId, next);
  return next;
}

export function completeSelectionAnalysisJob(jobId: string, result: AnalysisSuggestion) {
  return updateAnalysisJob(jobId, {
    phase: "completed",
    message: "Analysen är klar.",
    result,
    error: undefined
  });
}

export function completePhotoAnalysisJob(jobId: string, summary: string) {
  return updateAnalysisJob(jobId, {
    phase: "completed",
    message: "Bildanalysen är klar.",
    result: { summary },
    error: undefined
  });
}

export function failAnalysisJob(jobId: string, error: string) {
  return updateAnalysisJob(jobId, {
    phase: "failed",
    message: error,
    error
  });
}
