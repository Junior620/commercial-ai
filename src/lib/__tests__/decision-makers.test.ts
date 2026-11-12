import { describe, expect, it } from "vitest";
import { checkEligibility, linkedinProfileUrl, parseLinkedinResult, pickContacts, roleRank } from "@/lib/decision-makers";

const hit = (title: string, link: string, description = "") => ({ title, link, description });

describe("décideurs : lecture des résultats LinkedIn", () => {
  it("lit le nom et le poste, et vérifie l'entreprise", () => {
    expect(
      parseLinkedinResult(hit("Marie Durand - Responsable achats - Chocolaterie Durand | LinkedIn", "https://fr.linkedin.com/in/marie-durand-123?trk=x"), "Chocolaterie Durand")
    ).toEqual({ name: "Marie Durand", title: "Responsable achats", linkedinUrl: "https://www.linkedin.com/in/marie-durand-123", rank: 0 });
  });

  it("écarte une autre entreprise, une page qui n'est pas un profil, un titre sans nom", () => {
    expect(parseLinkedinResult(hit("Paul Martin - Purchasing Manager - Barry Callebaut | LinkedIn", "https://linkedin.com/in/pmartin"), "Chocolaterie Durand")).toBeNull();
    expect(parseLinkedinResult(hit("Chocolaterie Durand | LinkedIn", "https://linkedin.com/company/durand"), "Chocolaterie Durand")).toBeNull();
    expect(parseLinkedinResult(hit("Purchasing Manager - Chocolaterie Durand", "https://linkedin.com/in/x"), "Chocolaterie Durand")).toBeNull();
  });

  it("écarte les postes sans rapport avec un achat", () => {
    expect(parseLinkedinResult(hit("Léa Petit - Community Manager - Chocolaterie Durand", "https://linkedin.com/in/lea"), "Chocolaterie Durand")).toBeNull();
  });

  it("classe les achats avant la direction, sans doublon, 3 au plus", () => {
    const company = "Kakao Werk";
    const contacts = pickContacts(
      [
        hit("Hans Weber - Geschäftsführer - Kakao Werk", "https://de.linkedin.com/in/hweber"),
        hit("Anna Schmidt - Leiterin Einkauf - Kakao Werk", "https://de.linkedin.com/in/aschmidt"),
        hit("Anna Schmidt - Leiterin Einkauf - Kakao Werk", "https://www.linkedin.com/in/aschmidt/"),
        hit("Jonas Klein - R&D Manager - Kakao Werk", "https://linkedin.com/in/jklein"),
        hit("Eva Braun - Production Manager - Kakao Werk", "https://linkedin.com/in/ebraun"),
      ],
      company
    );
    expect(contacts.map((c) => c.name)).toEqual(["Anna Schmidt", "Jonas Klein", "Eva Braun"]);
  });

  it("normalise l'adresse du profil", () => {
    expect(linkedinProfileUrl("https://uk.linkedin.com/in/John-Doe/?originalSubdomain=uk")).toBe("https://www.linkedin.com/in/john-doe");
    expect(linkedinProfileUrl("https://example.com/in/john")).toBeNull();
    expect(roleRank("Head of Procurement")).toBe(0);
    expect(roleRank("Graphic designer")).toBeNull();
  });
});

describe("décideurs : garde-fous", () => {
  const base = { targetFit: "CORE", country: "FR", status: "NEW", prospectType: "COMMERCIAL" };
  it("autorise un prospect cœur de cible hors pays à accord préalable", () => {
    expect(checkEligibility(base)).toEqual({ ok: true });
  });
  it.each([
    ["pays à accord préalable", { country: "DE" }],
    ["secondaire", { targetFit: "SECONDARY" }],
    ["désinscrit", { status: "UNSUBSCRIBED" }],
    ["non commercial", { prospectType: "FINANCIAL" }],
  ])("refuse un prospect %s", (_label, override) => {
    expect(checkEligibility({ ...base, ...override }).ok).toBe(false);
  });
});
