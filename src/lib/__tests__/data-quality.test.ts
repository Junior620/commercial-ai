import { describe, expect, it } from "vitest";
import { deduplicateItems, normalizeCompanyName } from "@/lib/dedup";
import { calculateLeadScore, containsKeyword, priorityFromScore } from "@/lib/scoring";
import {
  inferProspectLanguageFromCountry,
  normalizeCountryToIso2,
  resolveCampaignLanguage,
} from "@/lib/prospect-language";
import { baseDomain, emailMatchesDomain, extractEmails, isPrivateHost } from "@/lib/email-extractor";
import { csvEscape, toCsv } from "@/lib/csv";
import { startOfTodayInTimeZone } from "@/lib/time";

describe("dédoublonnage", () => {
  it("conserve les noms non latins au lieu de les vider", () => {
    expect(normalizeCompanyName("شركة الكاكاو")).not.toBe("");
    const items = deduplicateItems([
      { company: "شركة الكاكاو", email: "a@x.com" },
      { company: "可可贸易", email: "b@y.com" },
    ]);
    expect(items).toHaveLength(2);
  });

  it("ne fusionne pas deux entreprises partageant une page Facebook", () => {
    const items = deduplicateItems([
      { company: "Cacao Alpha", website: "https://facebook.com/alpha", email: "a@alpha.ci" },
      { company: "Beta Chocolat", website: "https://facebook.com/beta", email: "b@beta.cm" },
    ]);
    expect(items).toHaveLength(2);
  });

  it("fusionne sur email ou domaine propre", () => {
    const items = deduplicateItems([
      { company: "Acme SARL", website: "https://www.acme.fr", email: "info@acme.fr" },
      { company: "ACME", website: "acme.fr", email: "sales@acme.fr" },
    ]);
    expect(items).toHaveLength(1);
  });
});

describe("scoring", () => {
  it("correspond sur mots entiers", () => {
    expect(containsKeyword("chocolate workshop", ["shop"])).toBe(false);
    expect(containsKeyword("chocolate shop", ["shop"])).toBe(true);
  });

  it("reconnaît un pays cible donné en code ISO (Google Maps)", () => {
    const result = calculateLeadScore({ title: "Cocoa Trading BV", country: "NL", website: "x.nl" });
    expect(result.reasons.some((r) => r.includes("marché prioritaire"))).toBe(true);
  });

  it("borne le score entre 0 et 100", () => {
    expect(calculateLeadScore({ title: "Boutique restaurant" }).score).toBe(0);
    const max = calculateLeadScore({
      title: "Cocoa butter manufacturer",
      categoryName: "Chocolate factory",
      country: "BE",
      email: "info@x.be",
      website: "x.be",
    });
    expect(max.score).toBeLessThanOrEqual(100);
    expect(priorityFromScore(max.score)).toBe("HIGH");
  });
});

describe("pays et langue", () => {
  it("normalise les noms de pays en ISO2", () => {
    expect(normalizeCountryToIso2("Côte d'Ivoire")).toBe("CI");
    expect(normalizeCountryToIso2("Belgium")).toBe("BE");
    expect(normalizeCountryToIso2("cm")).toBe("CM");
    expect(normalizeCountryToIso2("Douala, Cameroun")).toBe("CM");
  });

  it("déduit la langue de façon cohérente entre nom et code", () => {
    expect(inferProspectLanguageFromCountry("CH")).toBe(inferProspectLanguageFromCountry("Switzerland"));
    expect(inferProspectLanguageFromCountry("Cameroun")).toBe("fr");
    expect(inferProspectLanguageFromCountry("Brésil")).toBe("pt");
  });

  it("résout la langue d'une campagne « auto »", () => {
    expect(resolveCampaignLanguage("auto", "en", "FR")).toBe("fr");
    expect(resolveCampaignLanguage("es", "en", "FR")).toBe("es");
    expect(resolveCampaignLanguage("auto", "de", "AT")).toBe("de");
  });
});

describe("extraction d'emails", () => {
  it("ne fabrique pas d'email à partir de « at »", () => {
    expect(extractEmails("Our office located at abidjan.ci")).toEqual([]);
    expect(extractEmails("contact [at] acme.com")).toEqual([]); // pas de domaine complet
    expect(extractEmails("contact[at]acme.com")).toEqual(["contact@acme.com"]);
  });

  it("compare les domaines enregistrables", () => {
    expect(baseDomain("shop.acme.co.uk")).toBe("acme.co.uk");
    expect(baseDomain("mail.ofi.fr")).toBe("ofi.fr");
    expect(emailMatchesDomain("sales@acme.com", "www.acme.com")).toBe(true);
    expect(emailMatchesDomain("contact@annuaire.com", "acme.com")).toBe(false);
  });

  it("bloque les hôtes internes (SSRF)", () => {
    expect(isPrivateHost("169.254.169.254")).toBe(true);
    expect(isPrivateHost("10.0.0.4")).toBe(true);
    expect(isPrivateHost("localhost")).toBe(true);
    expect(isPrivateHost("acme.com")).toBe(false);
  });
});

describe("CSV", () => {
  it("neutralise les formules", () => {
    expect(csvEscape("=HYPERLINK(\"x\")")).toBe("\"'=HYPERLINK(\"\"x\"\")\"");
    expect(csvEscape("+33 6")).toBe("'+33 6");
    expect(toCsv(["a"], [["é"]]).startsWith("﻿")).toBe(true);
  });
});

describe("fuseau horaire", () => {
  it("calcule minuit à Douala (UTC+1)", () => {
    const start = startOfTodayInTimeZone("Africa/Douala", new Date("2026-11-10T00:30:00Z"));
    expect(start.toISOString()).toBe("2026-11-09T23:00:00.000Z");
  });
});
