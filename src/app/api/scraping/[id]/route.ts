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
  const job = await prisma.scrapingJob.findUnique({ where: { id } });
  if (!job) {
    return NextResponse.json({ error: "Job introuvable" }, { status: 404 });
  }

  const progress = job.progress as StoredProgress | null;
  const runs = progress?.runs;

  let liveRuns: { runId: string; label: string; apifyStatus: string }[] = [];

  if (
    runs &&
    runs.length > 0 &&
    job.status === "RUNNING" &&
    process.env.APIFY_API_TOKEN?.trim()
  ) {
    const statuses = await getApifyRunStatuses(runs.map((r) => r.runId));
    const statusById = new Map(statuses.map((s) => [s.runId, s.status]));
    liveRuns = runs.map((r) => ({
      runId: r.runId,
      label: r.label,
      apifyStatus: statusById.get(r.runId) ?? "?",
    }));
  } else if (runs && runs.length > 0) {
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
  let body: { action?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Corps JSON invalide" }, { status: 400 });
  }
  if (body.action !== "cancel") {
    return NextResponse.json({ error: "Action non supportee" }, { status: 400 });
  }

  const job = await prisma.scrapingJob.findUnique({ where: { id } });
  if (!job) {
    return NextResponse.json({ error: "Job introuvable" }, { status: 404 });
  }
  if (job.status !== "RUNNING") {
    return NextResponse.json(
      { error: "Seul un job en cours (RUNNING) peut etre annule" },
      { status: 400 }
    );
  }

  const progress = job.progress as StoredProgress | null;
  const runs = progress?.runs;
  if (runs?.length) {
    await Promise.allSettled(runs.map((r) => abortApifyRun(r.runId)));
  }

  const cancelledProgress: StoredProgress = {
    phase: "Annule",
    percent: typeof progress?.percent === "number" ? progress.percent : 0,
    detail:
      "Arret demande par l utilisateur. Les runs Apify en cours sont interrompus si possible.",
    runs: progress?.runs,
    updatedAt: new Date().toISOString(),
  };

  const updated = await prisma.scrapingJob.update({
    where: { id },
    data: {
      status: "CANCELLED",
      completedAt: new Date(),
      progress: cancelledProgress as object,
    },
  });

  return NextResponse.json(updated);
}
