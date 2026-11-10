import { describe, expect, it } from "vitest";
import { computeEmailEventEffect, type EmailEventState } from "@/lib/email-events";

const base: EmailEventState = { status: "SENT", deliveredAt: null, openedAt: null, clickedAt: null };
const now = new Date("2026-11-10T10:00:00Z");

describe("computeEmailEventEffect", () => {
  it("delivered : statut + compteur une seule fois", () => {
    const first = computeEmailEventEffect(base, "email.delivered", { now });
    expect(first.update).toEqual({ status: "DELIVERED", deliveredAt: now });
    expect(first.increments).toEqual(["deliveredCount"]);

    const again = computeEmailEventEffect({ ...base, status: "DELIVERED", deliveredAt: now }, "email.delivered", { now });
    expect(again.update).toEqual({});
    expect(again.increments).toEqual([]);
  });

  it("ne fait pas régresser un email répondu", () => {
    const effect = computeEmailEventEffect({ ...base, status: "REPLIED", openedAt: now }, "email.opened", { now });
    expect(effect.update.status).toBeUndefined();
    expect(effect.increments).toEqual([]);
  });

  it("un clic reçu avant l'ouverture compte aussi l'ouverture", () => {
    const effect = computeEmailEventEffect(base, "email.clicked", { now });
    expect(effect.update.status).toBe("CLICKED");
    expect(effect.increments.sort()).toEqual(["clickCount", "openCount"]);
  });

  it("une ouverture après un rebond ne change rien", () => {
    const effect = computeEmailEventEffect({ ...base, status: "BOUNCED" }, "email.opened", { now });
    expect(effect.update).toEqual({});
  });

  it("rebond définitif : liste de suppression ; rebond temporaire : non", () => {
    expect(computeEmailEventEffect(base, "email.bounced", { bounceType: "Permanent" }).suppress?.prospectStatus).toBe("COLD");
    expect(computeEmailEventEffect(base, "email.bounced", { bounceType: "Transient" }).suppress).toBeUndefined();
  });

  it("plainte : désinscription sans toucher au statut", () => {
    const effect = computeEmailEventEffect({ ...base, status: "OPENED" }, "email.complained");
    expect(effect.update).toEqual({});
    expect(effect.suppress?.prospectStatus).toBe("UNSUBSCRIBED");
  });
});
