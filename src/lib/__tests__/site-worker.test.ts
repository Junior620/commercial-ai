import { describe, expect, it } from "vitest";
import { checkUrlShape, GuardError, isPrivateAddress } from "../../../worker/src/guard";
import { looksBlocked } from "../../../worker/src/fetcher";
import { isPathAllowed, parseRobots } from "../../../worker/src/robots";
import { parseSerpOrganic } from "../../../worker/src/brightdata";
import { extractDescription, extractPhone, findContactLinks, needsRendering, siteRoot } from "../../../worker/src/crawl";

describe("garde anti-adresses internes", () => {
  it.each([
    "http://127.0.0.1:6379",
    "http://localhost:8000",
    "http://169.254.169.254/latest/meta-data",
    "http://[::1]:5000",
    "http://10.0.0.5/",
    "http://172.17.0.1/",
    "http://192.168.1.10/",
    "https://redis.internal/",
    "https://exemple.fr:5678/",
    "ftp://exemple.fr/",
    "file:///etc/passwd",
    "https://admin:secret@exemple.fr/",
  ])("refuse %s", (url) => {
    expect(() => checkUrlShape(url)).toThrow(GuardError);
  });

  it("accepte un site public en http ou https", () => {
    expect(checkUrlShape("https://www.chocolaterie-durand.fr/contact").hostname).toBe("www.chocolaterie-durand.fr");
    expect(checkUrlShape("http://exemple.be:8080/").port).toBe("8080");
  });

  it("reconnaît les adresses IP non routables, y compris IPv4 encapsulée en IPv6", () => {
    for (const ip of ["127.0.0.1", "10.1.2.3", "172.20.0.2", "192.168.0.1", "169.254.169.254", "::1", "fd00::1", "fe80::1", "::ffff:10.0.0.1"]) {
      expect(isPrivateAddress(ip), ip).toBe(true);
    }
    for (const ip of ["8.8.8.8", "169.58.99.28", "2a02:c207:2347:5618::1"]) {
      expect(isPrivateAddress(ip), ip).toBe(false);
    }
  });
});

describe("détection d'un site qui refuse les robots", () => {
  it("par le code HTTP", () => {
    for (const status of [401, 403, 429, 503]) expect(looksBlocked(status, "")).toBe(true);
    expect(looksBlocked(404, "")).toBe(false);
    expect(looksBlocked(200, "<html><body><h1>Chocolaterie Durand</h1></body></html>")).toBe(false);
  });

  it("par une page de vérification servie avec un code 200", () => {
    expect(looksBlocked(200, "<title>Just a moment...</title><div id='cf_chl_opt'></div>")).toBe(true);
    expect(looksBlocked(200, "<p>Please verify you are a human to continue</p>")).toBe(true);
  });
});

describe("robots.txt", () => {
  const text = [
    "User-agent: *",
    "Disallow: /admin",
    "Disallow: /private/",
    "Allow: /private/contact",
    "",
    "User-agent: SCPBProspectBot",
    "Disallow: /",
  ].join("\n");

  it("applique le groupe qui nomme ce robot, sinon le groupe général", () => {
    expect(parseRobots(text, "scpbprospectbot").disallow).toEqual(["/"]);
    expect(parseRobots(text, "autrebot").disallow).toEqual(["/admin", "/private/"]);
  });

  it("la règle la plus précise l'emporte", () => {
    const rules = parseRobots(text, "autrebot");
    expect(isPathAllowed(rules, "/contact")).toBe(true);
    expect(isPathAllowed(rules, "/admin/login")).toBe(false);
    expect(isPathAllowed(rules, "/private/notes")).toBe(false);
    expect(isPathAllowed(rules, "/private/contact")).toBe(true);
  });

  it("un fichier vide n'interdit rien", () => {
    expect(isPathAllowed(parseRobots("", "scpbprospectbot"), "/contact")).toBe(true);
  });
});

describe("lecture du HTML d'un site", () => {
  const home = `
    <html><head><title>Durand Chocolatier</title>
    <meta name="description" content="Chocolats artisanaux &amp; f&egrave;ves d'origine depuis 1952"></head>
    <body>
      <a href="/produits">Nos chocolats</a>
      <a href="/a-propos">Notre histoire</a>
      <a href="/nous-contacter">Contact</a>
      <a href="https://facebook.com/durand">Facebook</a>
      <a href="mailto:info@durand.fr">Écrire</a>
      <a href="/mentions-legales">Mentions légales</a>
      <a href="tel:+33 4 72 00 00 00">Appeler</a>
    </body></html>`;

  it("trouve les pages de coordonnées du même site, la page contact d'abord", () => {
    expect(findContactLinks(home, "https://durand.fr")).toEqual([
      "https://durand.fr/nous-contacter",
      "https://durand.fr/mentions-legales",
      "https://durand.fr/a-propos",
    ]);
  });

  it("extrait le téléphone et la présentation", () => {
    expect(extractPhone(home)).toBe("+33 4 72 00 00 00");
    expect(extractDescription(home)).toContain("Chocolats artisanaux &");
  });

  it("repère une page vide produite par JavaScript", () => {
    expect(needsRendering('<html><body><div id="root"></div><script src="/app.js"></script></body></html>')).toBe(true);
    expect(needsRendering(`<html><body><p>${"Chocolat artisanal de Lyon. ".repeat(40)}</p></body></html>`)).toBe(false);
  });

  it("ramène une adresse à la racine du site", () => {
    expect(siteRoot("durand.fr/boutique?x=1")).toBe("https://durand.fr");
    expect(siteRoot("http://www.durand.fr/contact")).toBe("http://www.durand.fr");
    expect(siteRoot("pas une adresse")).toBeNull();
  });
});

describe("résultats de recherche Bright Data", () => {
  it("lit les deux formes de réponse", () => {
    expect(parseSerpOrganic({ organic: [{ title: "Durand", link: "https://durand.fr", description: "info@durand.fr" }] })).toEqual([
      { title: "Durand", link: "https://durand.fr", description: "info@durand.fr" },
    ]);
    expect(parseSerpOrganic({ results: [{ title: "Durand", url: "https://durand.fr", snippet: "Contact" }] })[0].link).toBe("https://durand.fr");
  });

  it("renvoie une liste vide pour une réponse inattendue", () => {
    expect(parseSerpOrganic(null)).toEqual([]);
    expect(parseSerpOrganic("erreur")).toEqual([]);
    expect(parseSerpOrganic({ organic: "x" })).toEqual([]);
  });
});
