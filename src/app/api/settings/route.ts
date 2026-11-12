import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { parseJsonBody, serverError } from "@/lib/api";

const DEFAULTS = {
  dailyEmailLimit: 50,
  emailSpacingSeconds: 30,
  companyAddress: "",
  weeklyEmailTarget: 200,
  weeklyNewProspectTarget: 30,
  weeklyReplyTarget: 5,
  alertBouncePctThreshold: 5,
  minDaysBetweenCampaigns: 30,
};

const optionalText = (max: number) => z.string().trim().max(max).nullable().optional();

const SettingsSchema = z
  .object({
    dailyEmailLimit: z.number().int().min(1).max(500).optional(),
    emailSpacingSeconds: z.number().int().min(0).max(600).optional(),
    companyAddress: optionalText(300),
    weeklyEmailTarget: z.number().int().min(0).max(100000).optional(),
    weeklyNewProspectTarget: z.number().int().min(0).max(100000).optional(),
    weeklyReplyTarget: z.number().int().min(0).max(100000).optional(),
    alertBouncePctThreshold: z.number().int().min(1).max(100).optional(),
    minDaysBetweenCampaigns: z.number().int().min(0).max(365).optional(),
  })
  .strip();

export async function GET() {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const settings = await prisma.appSettings.findUnique({ where: { id: "default" } });
  return NextResponse.json(settings || DEFAULTS);
}

export async function PUT(req: NextRequest) {
  const auth = await requireUser(["ADMIN"]);
  if (!auth.ok) return auth.response;

  const parsed = await parseJsonBody(req, SettingsSchema);
  if (!parsed.ok) return parsed.response;
  const data = Object.fromEntries(Object.entries(parsed.data).filter(([, v]) => v !== undefined));

  try {
    const settings = await prisma.appSettings.upsert({
      where: { id: "default" },
      update: data,
      create: { id: "default", ...DEFAULTS, ...data },
    });
    return NextResponse.json(settings);
  } catch (err) {
    return serverError("settings:update", err, "Erreur de sauvegarde");
  }
}
