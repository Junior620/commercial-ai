import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { abortApifyRun, getApifyRunStatuses } from "@/lib/apify";

type ProgressRun = { runId: string; label: string };
type StoredProgress = {
  phase: string;
  percent: number;
  detail?: string;
  runs?: ProgressRun[];
  updatedAt?: string;
};

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const job = await prisma.scrapingJob.findFirst({
    where: { id, kind: "FINANCIAL" },
  });
  if (!job) {
    return NextResponse.json({ error: "Job introuvable" }, { status: 404 });
  }

  const progress = job.progress as StoredProgress | null;
  const runs = progress?.runs ?? [];

  let liveRuns: { runId: string; label: string; apifyStatus: string }[] = [];
  if (
    runs.length > 0 &&
    job.status === "RUNNING" &&
    process.env.APIFY_API_TOKEN?.trim()
  ) {
    const statuses = await getApifyRunStatuses(runs.map((r) => r.runId));
    const byId = new Map(statuses.map((s) => [s.runId, s.status]));
    liveRuns = runs.map((r) => ({
      runId: r.runId,
      label: r.label,
      apifyStatus: byId.get(r.runId) ?? "?",
    }));
  } else if (runs.length > 0) {
    liveRuns = runs.map((r) => ({
      runId: r.runId,
      label: r.label,
      apifyStatus: job.status === "RUNNING" ? "…" : job.status,
    }));
  }

  return NextResponse.json({ job, liveRuns });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  if (body.action !== "cancel") {
    return NextResponse.json({ error: "Action non supportee" }, { status: 400 });
  }

  const job = await prisma.scrapingJob.findFirst({
    where: { id, kind: "FINANCIAL" },
  });
  if (!job) {
    return NextResponse.json({ error: "Job introuvable" }, { status: 404 });
  }
  if (job.status !== "RUNNING") {
    return NextResponse.json({ error: "Job non annulable" }, { status: 400 });
  }

  const progress = (job.progress as StoredProgress | null) ?? null;
  const runs = progress?.runs ?? [];
  if (runs.length) {
    await Promise.allSettled(runs.map((r) => abortApifyRun(r.runId)));
  }

  const updated = await prisma.scrapingJob.update({
    where: { id: job.id },
    data: {
      status: "CANCELLED",
      completedAt: new Date(),
      progress: {
        phase: "Annule",
        percent: progress?.percent ?? 0,
        detail: "Arret demande par l utilisateur.",
        runs,
        updatedAt: new Date().toISOString(),
      } as object,
    },
  });
  return NextResponse.json(updated);
}
