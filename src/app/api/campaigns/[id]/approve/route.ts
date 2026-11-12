import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser, WRITE_ROLES } from "@/lib/auth";
import { parseJsonBody, serverError } from "@/lib/api";

const ApproveSchema = z
  .object({
    /** Emails concernés ; absent = tous les emails en attente de la campagne */
    emailIds: z.array(z.string().max(60)).min(1).max(2000).optional(),
    approved: z.boolean(),
  })
  .strict();

/**
 * Approuve (ou retire l'approbation) des emails en attente.
 * Seul un email approuvé peut être envoyé, relances comprises.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser(WRITE_ROLES);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const parsed = await parseJsonBody(req, ApproveSchema);
  if (!parsed.ok) return parsed.response;
  const { emailIds, approved } = parsed.data;

  try {
    const { count } = await prisma.email.updateMany({
      where: {
        campaignId: id,
        status: "PENDING",
        ...(emailIds ? { id: { in: emailIds } } : {}),
        approvedAt: approved ? null : { not: null },
      },
      data: approved ? { approvedAt: new Date(), approvedById: auth.user.id } : { approvedAt: null, approvedById: null },
    });
    const [toApprove, approvedCount] = await Promise.all([
      prisma.email.count({ where: { campaignId: id, status: "PENDING", approvedAt: null } }),
      prisma.email.count({ where: { campaignId: id, status: "PENDING", approvedAt: { not: null } } }),
    ]);
    return NextResponse.json({ updated: count, toApprove, approved: approvedCount });
  } catch (err) {
    return serverError("campaigns:approve", err);
  }
}
