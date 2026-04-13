import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const campaign = await prisma.campaign.findUnique({
    where: { id },
    include: {
      segment: { select: { name: true, id: true } },
      emails: {
        include: {
          prospect: { select: { company: true, email: true, contact: true } },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!campaign) {
    return NextResponse.json(
      { error: "Campagne non trouvee" },
      { status: 404 }
    );
  }

  return NextResponse.json(campaign);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();
  const campaign = await prisma.campaign.update({
    where: { id },
    data: body,
  });
  return NextResponse.json(campaign);
}
