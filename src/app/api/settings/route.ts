import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const settings = await prisma.appSettings.findUnique({
    where: { id: "default" },
  });
  return NextResponse.json(
    settings || {
      dailyEmailLimit: 50,
      emailSpacingSeconds: 30,
      defaultSignature: "",
      companyName: "",
      senderName: "",
      senderEmail: "",
    }
  );
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const settings = await prisma.appSettings.upsert({
      where: { id: "default" },
      update: {
        dailyEmailLimit: body.dailyEmailLimit,
        emailSpacingSeconds: body.emailSpacingSeconds,
        defaultSignature: body.defaultSignature,
        companyName: body.companyName,
        senderName: body.senderName,
        senderEmail: body.senderEmail,
      },
      create: {
        id: "default",
        dailyEmailLimit: body.dailyEmailLimit ?? 50,
        emailSpacingSeconds: body.emailSpacingSeconds ?? 30,
        defaultSignature: body.defaultSignature,
        companyName: body.companyName,
        senderName: body.senderName,
        senderEmail: body.senderEmail,
      },
    });
    return NextResponse.json(settings);
  } catch {
    return NextResponse.json(
      { error: "Erreur de sauvegarde" },
      { status: 500 }
    );
  }
}
