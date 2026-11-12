import { prisma } from "@/lib/prisma";

export type AlertKind = "config" | "bounce" | "send" | "generate" | "scraping";

/**
 * Lève une alerte visible sur le tableau de bord.
 * Une seule alerte non traitée par type : le message est mis à jour au lieu d'empiler.
 */
export async function raiseAlert(kind: AlertKind, message: string): Promise<void> {
  try {
    const open = await prisma.jobAlert.findFirst({ where: { kind, resolvedAt: null }, select: { id: true } });
    if (open) {
      await prisma.jobAlert.update({ where: { id: open.id }, data: { message: message.slice(0, 1000), createdAt: new Date() } });
    } else {
      await prisma.jobAlert.create({ data: { kind, message: message.slice(0, 1000) } });
    }
  } catch (err) {
    console.error("[alerts] impossible d'enregistrer l'alerte :", err);
  }
}

export async function resolveAlerts(kind: AlertKind): Promise<void> {
  try {
    await prisma.jobAlert.updateMany({ where: { kind, resolvedAt: null }, data: { resolvedAt: new Date() } });
  } catch (err) {
    console.error("[alerts] impossible de clore l'alerte :", err);
  }
}
