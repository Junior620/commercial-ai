import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const ProspectSchema = z.object({
  company: z.string().min(1),
  contact: z.string().optional(),
  email: z.string().email(),
  phone: z.string().optional(),
  country: z.string().min(1),
  sector: z.string().optional(),
  clientType: z.string().optional(),
  product: z.string().optional(),
  language: z.string().default("en"),
  priority: z.enum(["HIGH", "MEDIUM", "LOW"]).default("MEDIUM"),
  website: z.string().optional(),
  source: z.string().optional(),
  notes: z.string().optional(),
  prospectType: z.enum(["COMMERCIAL", "FINANCIAL"]).optional(),
  financialCategory: z.string().optional(),
});

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const country = searchParams.get("country");
  const search = searchParams.get("search");
  const limit = parseInt(searchParams.get("limit") || "100");
  const offset = parseInt(searchParams.get("offset") || "0");
  const typeParam = searchParams.get("type");
  const type =
    typeParam === "FINANCIAL" || typeParam === "COMMERCIAL"
      ? typeParam
      : "COMMERCIAL";

  const where: Record<string, unknown> = {};
  where.prospectType = type;
  if (status && status !== "all") where.status = status;
  if (country) where.country = country;
  if (search) {
    where.OR = [
      { company: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
      { contact: { contains: search, mode: "insensitive" } },
      { country: { contains: search, mode: "insensitive" } },
    ];
  }

  const prospects = await prisma.prospect.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit,
    skip: offset,
  });

  return NextResponse.json(prospects);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const data = ProspectSchema.parse(body);

    const existing = await prisma.prospect.findUnique({
      where: { email: data.email },
    });

    if (existing) {
      return NextResponse.json(
        { error: "Un prospect avec cet email existe deja" },
        { status: 409 }
      );
    }

    const prospect = await prisma.prospect.create({
      data: {
        ...data,
        prospectType: data.prospectType ?? "COMMERCIAL",
        financialCategory: data.financialCategory,
      },
    });
    return NextResponse.json(prospect, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: err.issues[0].message },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Erreur interne" },
      { status: 500 }
    );
  }
}
