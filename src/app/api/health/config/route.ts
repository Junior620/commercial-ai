import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { getConfigHealth } from "@/lib/config-health";
import { strictOptInCountries } from "@/lib/compliance";
import { serverError } from "@/lib/api";

/** État de la configuration (variables, DNS du domaine d'envoi, site joignable). */
export async function GET() {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  try {
    const settings = await prisma.appSettings.findUnique({ where: { id: "default" }, select: { companyAddress: true } });
    const health = await getConfigHealth({ companyAddress: settings?.companyAddress, deep: true });
    return NextResponse.json({ ...health, strictCountries: strictOptInCountries() });
  } catch (err) {
    return serverError("health:config", err);
  }
}
