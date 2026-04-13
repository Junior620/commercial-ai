import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
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
