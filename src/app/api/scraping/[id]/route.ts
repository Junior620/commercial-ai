import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { abortRuns, liveRunStatuses, type RunEntry } from "@/lib/scraping/pipeline";
import { requireUser, WRITE_ROLES } from "@/lib/auth";

type ProgressRun = RunEntry;

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
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const job = await prisma.scrapingJob.findUnique({ where: { id } });
  if (!job) {
    return NextResponse.json({ error: "Job introuvable" }, { status: 404 });
  }

  const progress = job.progress as StoredProgress | null;
  const runs = progress?.runs;

  let liveRuns: { runId: string; label: string; apifyStatus: string }[] = [];

  if (runs && runs.length > 0 && job.status === "RUNNING") {
    try {
      liveRuns = (await liveRunStatuses(runs)).map((r) => ({ runId: r.runId, label: r.label, apifyStatus: r.status }));
    } catch {
      liveRuns = runs.map((r) => ({ runId: r.runId, label: r.label, apifyStatus: "?" }));
    }
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
  const auth = await requireUser(WRITE_ROLES);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  let body: { action?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Corps JSON invalide" }, { status: 400 });
  }
  if (body.action !== "cancel") {
    return NextResponse.json({ error: "Action non supportée" }, { status: 400 });
  }

  const job = await prisma.scrapingJob.findUnique({ where: { id } });
  if (!job) {
    return NextResponse.json({ error: "Job introuvable" }, { status: 404 });
  }
  if (job.status !== "RUNNING") {
    return NextResponse.json(
      { error: "Seul un scraping en cours peut être annulé" },
      { status: 400 }
    );
  }

  const progress = job.progress as StoredProgress | null;
  const runs = progress?.runs;
  if (runs?.length) {
    await abortRuns(runs).catch(() => undefined);
  }

  const cancelledProgress: StoredProgress = {
    phase: "Annulé",
    percent: typeof progress?.percent === "number" ? progress.percent : 0,
    detail:
      `Arrêt demandé par ${auth.user.email}. Les recherches en cours sont interrompues.`,
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
