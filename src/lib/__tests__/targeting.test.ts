import { describe, expect, it } from "vitest";
import { classifyTarget, primaryProduct } from "@/lib/targeting";
import { calculateLeadScore, inferProduct, priorityFromScore } from "@/lib/scoring";

/** Cas réels extraits de la base (nom, catégorie Google Maps). */
const CASES: [string, string, string, string?][] = [
  ["Blue Bottle", "Coffee shop", "OUT_OF_SCOPE"],
  ["Chez Marcel", "Grocery store", "OUT_OF_SCOPE"],
  ["Trader Joe's", "Grocery store", "OUT_OF_SCOPE"],
  ["Leonidas", "Chocolate shop", "OUT_OF_SCOPE"],
  ["Hôtel du Parc", "Hotel", "OUT_OF_SCOPE"],
  ["Choprabisco - Royal Belgian Association of the Chocolate Industry", "Association / Organization", "OUT_OF_SCOPE"],
  ["Ivory Cocoa Exporters", "Exporter", "OUT_OF_SCOPE"],
  ["Callebaut Wieze", "Chocolate factory", "CORE", "cocoa_mass"],
  ["Legast Artisan Chocolatier", "Chocolate factory", "SECONDARY"],
  ["Chocolatier M", "Chocolate shop", "SECONDARY"],
  ["Maison Bean to Bar", "Chocolate artisan", "SECONDARY", "cocoa_mass"],
  ["Lush Manufacturing", "Cosmetic products manufacturer", "CORE", "cocoa_butter"],
  ["Olam Food Ingredients Spain, SL", "Wholesaler", "CORE"],
  ["COCOA TRADE & CONSULTANTS", "Importer", "CORE", "cocoa_beans"],
  ["Lotus Biscuits", "Food manufacturer", "CORE", "cocoa_powder"],
  ["Stumptown Coffee Roasters", "Coffee shop", "SECONDARY"],
  ["Picard's Peanuts", "Food products supplier", "SECONDARY"],
];

describe("classifyTarget", () => {
  it.each(CASES)("%s (%s) → %s", (title, categoryName, fit, product) => {
    const result = classifyTarget({ title, categoryName });
    expect(result.fit).toBe(fit);
    if (product) expect(primaryProduct(result)).toBe(product);
  });

  it("détecte un produit mentionné dans la description", () => {
    const r = classifyTarget({ title: "Delta Foods", categoryName: "Manufacturer", description: "We use alkalized cocoa powder for our biscuits" });
    expect(r.fit).toBe("CORE");
    expect(r.productNeeds).toContain("cocoa_powder");
  });
});

describe("scoring orienté fèves et dérivés", () => {
  it("un coffee shop ne peut pas être prioritaire", () => {
    const s = calculateLeadScore({ title: "Coffee Corner", categoryName: "Coffee shop", country: "BE", email: "a@b.be", website: "b.be" });
    expect(s.fit).toBe("OUT_OF_SCOPE");
    expect(s.score).toBeLessThanOrEqual(15);
    expect(priorityFromScore(s.score, s.fit)).toBe("LOW");
    expect(inferProduct({ title: "Coffee Corner", categoryName: "Coffee shop" })).toBeNull();
  });

  it("une chocolaterie industrielle en marché prioritaire est prioritaire", () => {
    const s = calculateLeadScore({ title: "Chocolaterie Durand", categoryName: "Chocolate factory", country: "FR", email: "x@d.fr", website: "d.fr" });
    expect(s.fit).toBe("CORE");
    expect(s.score).toBeGreaterThanOrEqual(60);
    expect(priorityFromScore(s.score, s.fit)).toBe("HIGH");
  });

  it("un artisan reste plafonné en secondaire", () => {
    const s = calculateLeadScore({ title: "Artisan chocolatier", categoryName: "Chocolate artisan", country: "BE", email: "x@y.be", website: "y.be", description: "bean to bar, cocoa beans" });
    expect(s.fit).toBe("SECONDARY");
    expect(s.score).toBeLessThanOrEqual(55);
  });
});
