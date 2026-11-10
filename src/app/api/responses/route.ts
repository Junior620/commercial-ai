import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

export async function GET() {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const responses = await prisma.response.findMany({
    include: {
      prospect: { select: { company: true, email: true } },
      email: { select: { subject: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return NextResponse.json(responses);
}
