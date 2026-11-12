import { describe, expect, it } from "vitest";
import { chooseMapsProviders, mergeWorkerResults, workerTargets, type EnrichedPlace } from "@/lib/scraping/pipeline";
import { brightDataCountry, mapBrightDataPlace } from "@/lib/brightdata";

describe("choix de la source Google Maps", () => {
  it("Apify d'abord, Bright Data en secours", () => {
    expect(chooseMapsProviders({ apify: true, brightdata: true, hasCountry: true })).toEqual(["apify", "brightdata"]);
  });

  it("Bright Data exige un pays : une recherche sans pays reste sur Apify", () => {
    expect(chooseMapsProviders({ apify: true, brightdata: true, hasCountry: false })).toEqual(["apify"]);
  });

  it("respecte la source principale choisie et les clés absentes", () => {
    expect(chooseMapsProviders({ apify: true, brightdata: true, hasCountry: true, primary: "brightdata" })).toEqual(["brightdata", "apify"]);
    expect(chooseMapsProviders({ apify: false, brightdata: true, hasCountry: true })).toEqual(["brightdata"]);
    expect(chooseMapsProviders({ apify: false, brightdata: false, hasCountry: true })).toEqual([]);
  });
});

describe("fiches Google Maps de Bright Data", () => {
  it("convertit une fiche vers le format commun", () => {
    expect(
      mapBrightDataPlace({
        name: "Chocolaterie Durand",
        open_website: "https://durand.fr",
        phone_number: "+33 4 72 00 00 00",
        category: "Chocolate factory",
        country_code: "fr",
        address: "1 rue du Cacao, Lyon",
        description: "Fabricant de chocolat",
        rating: 4.7,
      })
    ).toEqual({
      title: "Chocolaterie Durand",
      website: "https://durand.fr",
      phone: "+33 4 72 00 00 00",
      address: "1 rue du Cacao, Lyon",
      country: "FR",
      categoryName: "Chocolate factory",
      url: undefined,
      description: "Fabricant de chocolat",
      totalScore: 4.7,
    });
  });

  it("écarte les lignes en erreur et les établissements fermés", () => {
    expect(mapBrightDataPlace({ error: "Not found" })).toBeNull();
    expect(mapBrightDataPlace({ name: "Fermé", permanently_closed: true })).toBeNull();
  });

  it("traduit le pays en code à deux lettres", () => {
    expect(brightDataCountry("Belgium")).toBe("BE");
    expect(brightDataCountry("")).toBeNull();
  });
});

describe("fusion des résultats du service de lecture", () => {
  const place = (title: string, website: string | undefined, emails: string[] = [], contactName: string | null = null): EnrichedPlace => ({
    place: { title, website },
    domain: website ? new URL(website).hostname.replace(/^www\./, "") : null,
    emails,
    contactName,
    emailSource: emails.length ? "maps" : null,
  });
  const result = (url: string, emails: string[], extra: Partial<{ contactName: string; phone: string; description: string }> = {}) => ({
    url,
    domain: new URL(url).hostname.replace(/^www\./, ""),
    emails,
    contactName: extra.contactName ?? null,
    phone: extra.phone ?? null,
    description: extra.description ?? null,
    pagesRead: 2,
    via: ["direct"],
    blocked: false,
    error: null,
  });

  it("envoie d'abord les sites sans email, puis ceux sans nom de contact", () => {
    const places = [
      place("A", "https://a.fr", ["info@a.fr"]),
      place("B", "https://b.fr"),
      place("C", undefined),
      place("D", "https://d.fr", ["info@d.fr"], "Jean Dupont"),
    ];
    expect(workerTargets(places, 10)).toEqual(["https://b.fr", "https://a.fr"]);
    expect(workerTargets(places, 1)).toEqual(["https://b.fr"]);
  });

  it("complète les fiches sans écraser ce qui existe", () => {
    const places = [place("Durand", "https://www.durand.fr"), place("Martin", "https://martin.be", ["contact@martin.be"])];
    const added = mergeWorkerResults(places, [
      result("https://www.durand.fr", ["info@durand.fr"], { contactName: "Marie Durand", phone: "+33 1", description: "Chocolatier" }),
      result("https://martin.be", ["autre@martin.be"], { contactName: "Paul Martin" }),
    ]);
    expect(added).toBe(1);
    expect(places[0].emails).toEqual(["info@durand.fr"]);
    expect(places[0].emailSource).toBe("worker");
    expect(places[0].contactName).toBe("Marie Durand");
    expect(places[0].place.description).toBe("Chocolatier");
    expect(places[1].emails).toEqual(["contact@martin.be"]);
    expect(places[1].contactName).toBe("Paul Martin");
  });
});
