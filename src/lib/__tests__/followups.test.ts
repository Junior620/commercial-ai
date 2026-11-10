import { describe, expect, it } from "vitest";
import { computeDueFollowUps, type SequenceEmail } from "@/lib/followups";

const DAY = 24 * 60 * 60 * 1000;
const now = new Date("2026-11-10T09:00:00Z");
const ago = (days: number) => new Date(now.getTime() - days * DAY);

function email(partial: Partial<SequenceEmail>): SequenceEmail {
  return { prospectId: "p1", type: "INITIAL", status: "DELIVERED", sentAt: ago(5), repliedAt: null, ...partial };
}

const opts = { delayDays: 4, maxFollowUps: 2, now };

describe("computeDueFollowUps", () => {
  it("planifie la relance 1 quand l'email initial a dépassé le délai", () => {
    expect(computeDueFollowUps([email({})], opts)).toEqual([{ prospectId: "p1", followUpNumber: 1 }]);
  });

  it("n'envoie rien avant le délai", () => {
    expect(computeDueFollowUps([email({ sentAt: ago(2) })], opts)).toEqual([]);
  });

  it("calcule la relance 2 depuis la date d'envoi de la relance 1 (et non de l'initial)", () => {
    const emails = [email({ sentAt: ago(10) }), email({ type: "FOLLOWUP_1", sentAt: ago(1) })];
    expect(computeDueFollowUps(emails, opts)).toEqual([]);
    const later = [email({ sentAt: ago(10) }), email({ type: "FOLLOWUP_1", sentAt: ago(5) })];
    expect(computeDueFollowUps(later, opts)).toEqual([{ prospectId: "p1", followUpNumber: 2 }]);
  });

  it("ne crée pas de nouvelle relance tant que la précédente est en attente", () => {
    const emails = [email({ sentAt: ago(10) }), email({ type: "FOLLOWUP_1", status: "PENDING", sentAt: null })];
    expect(computeDueFollowUps(emails, opts)).toEqual([]);
  });

  it("s'arrête à maxFollowUps", () => {
    const emails = [
      email({ sentAt: ago(20) }),
      email({ type: "FOLLOWUP_1", sentAt: ago(15) }),
      email({ type: "FOLLOWUP_2", sentAt: ago(10) }),
    ];
    expect(computeDueFollowUps(emails, opts)).toEqual([]);
  });

  it("s'arrête après une réponse ou un rebond", () => {
    expect(computeDueFollowUps([email({ status: "REPLIED" })], opts)).toEqual([]);
    expect(computeDueFollowUps([email({ status: "BOUNCED" })], opts)).toEqual([]);
  });

  it("relance aussi les prospects qui ont cliqué", () => {
    expect(computeDueFollowUps([email({ status: "CLICKED" })], opts)).toHaveLength(1);
  });

  it("ignore les prospects exclus", () => {
    expect(computeDueFollowUps([email({})], { ...opts, excludedProspectIds: new Set(["p1"]) })).toEqual([]);
  });
});
