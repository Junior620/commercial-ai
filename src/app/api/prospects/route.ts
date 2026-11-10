import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser, WRITE_ROLES } from "@/lib/auth";
import { parseJsonBody, serverError } from "@/lib/api";
import { inferProspectLanguageFromCountry, normalizeCountryToIso2 } from "@/lib/prospect-language";
import { isSuppressed } from "@/lib/sending";
import type { Prisma } from "@/generated/prisma/client";

const STATUSES = ["NEW", "CONTACTED", "IN_DISCUSSION", "CONVERTED", "COLD", "UNSUBSCRIBED"] as const;

const ProspectSchema = z.object({
  company: z.string().trim().min(1, "Entreprise requise").max(200),
  contact: z.string().trim().max(120).optional(),
  email: z.string().trim().toLowerCase().email("Email invalide").max(200),
  phone: z.string().trim().max(60).optional(),
  country: z.string().trim().min(1, "Pays requis").max(80),
  sector: z.string().trim().max(200).optional(),
  clientType: z.string().trim().max(60).optional(),
  product: z.string().trim().max(60).optional(),
  language: z.string().trim().max(10).optional(),
  priority: z.enum(["HIGH", "MEDIUM", "LOW"]).default("MEDIUM"),
  website: z.string().trim().max(300).optional(),
  source: z.string().trim().max(60).optional(),
  notes: z.string().trim().max(5000).optional(),
});

const QuerySchema = z.object({
  status: z.enum([...STATUSES, "all"]).optional(),
  country: z.string().max(80).optional(),
  search: z.string().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(2000).default(100),
  offset: z.coerce.number().int().min(0).default(0),
});

export async function GET(req: NextRequest) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const parsed = QuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!parsed.success) return NextResponse.json({ error: "Paramètres invalides" }, { status: 400 });
  const { status, country, search, limit, offset } = parsed.data;

  const where: Prisma.ProspectWhereInput = { prospectType: "COMMERCIAL" };
  if (status && status !== "all") where.status = status;
  if (country) where.country = normalizeCountryToIso2(country);
  if (search) {
    where.OR = [
      { company: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
      { contact: { contains: search, mode: "insensitive" } },
      { country: { contains: search, mode: "insensitive" } },
    ];
  }

  const prospects = await prisma.prospect.findMany({ where, orderBy: { createdAt: "desc" }, take: limit, skip: offset });
  return NextResponse.json(prospects);
}

export async function POST(req: NextRequest) {
  const auth = await requireUser(WRITE_ROLES);
  if (!auth.ok) return auth.response;

  const parsed = await parseJsonBody(req, ProspectSchema);
  if (!parsed.ok) return parsed.response;
  const data = parsed.data;

  try {
    const existing = await prisma.prospect.findFirst({
      where: { email: { equals: data.email, mode: "insensitive" } },
      select: { id: true },
    });
    if (existing) {
      return NextResponse.json({ error: "Un prospect avec cet email existe déjà" }, { status: 409 });
    }

    const country = normalizeCountryToIso2(data.country);
    const prospect = await prisma.prospect.create({
      data: {
        ...data,
        country,
        language: data.language || inferProspectLanguageFromCountry(country),
        source: data.source || "manual",
        prospectType: "COMMERCIAL",
        status: (await isSuppressed(data.email)) ? "UNSUBSCRIBED" : "NEW",
      },
    });
    return NextResponse.json(prospect, { status: 201 });
  } catch (err) {
    return serverError("prospects:create", err);
  }
}
